const { pool } = require('../../db/connector');
const {DateTime} = require('luxon')


// Place this helper function at the top of your 'create.js' file or in a separate utils file.
const getNonWorkingDays = async (connection, startDate, endDate) => {
  // 1. Get all declared holidays within the date range
  const holidaySql = 'SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN ? AND ?';
  const [holidays] = await connection.query(holidaySql, [startDate.toISODate(), endDate.toISODate()]);
  const holidayDates = new Set(holidays.map(h => DateTime.fromJSDate(h.holiday_date).toISODate()));

  // 2. Get the weekly off days (e.g., Saturday, Sunday)
  const workWeekSql = 'SELECT day_of_week FROM work_week WHERE is_working_day = FALSE';
  const [weeklyOffs] = await connection.query(workWeekSql);
  const offDays = weeklyOffs.map(d => d.day_of_week); // e.g., ['saturday', 'sunday']

  // 3. Iterate through the date range and add weekly offs to the set
  let currentDate = startDate;
  while (currentDate <= endDate) {
    const dayName = currentDate.toFormat('EEEE').toLowerCase(); // e.g., 'sunday'
    if (offDays.includes(dayName)) {
      holidayDates.add(currentDate.toISODate());
    }
    currentDate = currentDate.plus({ days: 1 });
  }

  return holidayDates; // Returns a Set of all non-working dates
};

/**
 * @description Create a new leave type.
 */
const createLeaveType = async (req, res) => {
  const {
    name,
    description,
    initial_balance = 0,
    accurable = false,
    accural_rate = 0,
    max_balance = 0,
    is_encashable =false
  } = req.body;

  if (!name || !description) {
    return res.status(400).json({ message: 'Name and description are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      INSERT INTO leave_types 
      (name, description, initial_balance, accurable, accural_rate, max_balance,is_encashable) 
      VALUES (?, ?, ?, ?, ?, ?,?)
    `;
    const [result] = await connection.query(sql, [
      name,
      description,
      initial_balance,
      accurable,
      accural_rate,
      max_balance,
      is_encashable
    ]);
    res.status(201).json({
      success: true,
      message: 'Leave type created successfully.',
      leaveType: { id: result.insertId, ...req.body },
    });
  } catch (error) {
    console.error('Error creating leave type:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};



/**
 * @description Creates a new leave request with holiday and overlap validation.
 */
const createLeaveRequest = async (req, res) => {
  const employeeId = req.user.id;
  const { leave_type, leave_description, from_date, to_date } = req.body;

  if (!leave_type || !leave_description || !from_date || !to_date) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const fromDate = DateTime.fromISO(from_date);
  const toDate = DateTime.fromISO(to_date);

  if (!fromDate.isValid || !toDate.isValid) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
  }
  if (fromDate > toDate) {
    return res.status(400).json({ message: 'Start date cannot be after the end date.' });
  }
  if (fromDate < DateTime.now().startOf('day')) {
      return res.status(400).json({ message: 'Cannot apply for leave in the past.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. NEW: Check for overlapping leave requests
    const overlapSql = `
      SELECT id FROM employee_leave_records 
      WHERE employee_id = ? 
      AND rejection_reason IS NULL 
      AND (? <= to_date AND ? >= from_date)
    `;
    const [overlappingLeaves] = await connection.query(overlapSql, [employeeId, from_date, to_date]);
    if (overlappingLeaves.length > 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'This leave request overlaps with an existing request.' });
    }

    // 2. NEW: Get all non-working days in the requested period
    const nonWorkingDays = await getNonWorkingDays(connection, fromDate, toDate);

    // 3. NEW: Validate that the leave does not start or end on a non-working day
    if (nonWorkingDays.has(fromDate.toISODate()) || nonWorkingDays.has(toDate.toISODate())) {
        await connection.rollback();
        return res.status(400).json({ message: 'Leave cannot start or end on a holiday or weekly off.' });
    }

    // 4. MODIFIED: Calculate duration based on working days only
    let duration = 0;
    let currentDate = fromDate;
    while (currentDate <= toDate) {
        if (!nonWorkingDays.has(currentDate.toISODate())) {
            duration++;
        }
        currentDate = currentDate.plus({ days: 1 });
    }

    if (duration <= 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'The selected date range does not contain any working days.' });
    }

    // 5. Check if the user has enough leave balance for the effective duration
    const balanceSql = 'SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = ?';
    const [[leaveBalance]] = await connection.query(balanceSql, [employeeId, leave_type]);
    if (!leaveBalance || leaveBalance.balance < duration) {
      await connection.rollback();
      return res.status(400).json({ message: `Insufficient leave balance. Required: ${duration}, Available: ${leaveBalance ? leaveBalance.balance : 0}` });
    }
    
    // 6. Find the approval manager (reports_to)
    const [[manager]] = await connection.query('SELECT reports_to FROM user WHERE id = ?', [employeeId]);
    if (!manager || !manager.reports_to) {
        await connection.rollback();
        return res.status(400).json({ message: 'Your reporting manager is not set.' });
    }
    const primaryUserId = manager.reports_to;

    // 7. Insert the leave request record
    const insertSql = `
      INSERT INTO employee_leave_records (leave_type, employee_id, leave_description, applied_date, from_date, to_date, primary_user) 
      VALUES (?, ?, ?, CURDATE(), ?, ?, ?)
    `;
    await connection.query(insertSql, [leave_type, employeeId, leave_description, from_date, to_date, primaryUserId]);

    await connection.commit();
    res.status(201).json({ success: true, message: `Leave request for ${duration} working day(s) submitted successfully.` });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating leave request:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createLeaveType, createLeaveRequest };