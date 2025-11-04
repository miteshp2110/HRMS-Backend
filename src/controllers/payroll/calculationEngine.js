


const { DateTime } = require("luxon");
const { evaluate } = require("mathjs");

function toIdNameMap(rows) {
  return rows.reduce((map, row) => {
    map[row.id] = row.name;
    return map;
  }, {});
}

// NEW FUNCTION: Calculate working days excluding weekends and holidays
async function calculateWorkingDaysInPeriod(connection, startDate, endDate) {
  try {
    const [result] = await connection.query(
      `
      SELECT COUNT(DISTINCT date_in_period) as working_days
      FROM (
          SELECT DATE_ADD(?, INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY) as date_in_period
          FROM 
              (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
               UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 
               UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
          CROSS JOIN 
              (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
               UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 
               UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
          CROSS JOIN 
              (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
               UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 
               UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
          WHERE DATE_ADD(?, INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY) <= ?
      ) dates
      LEFT JOIN work_week ww ON DAYNAME(dates.date_in_period) = ww.day_of_week 
          AND ww.is_working_day = 0
      LEFT JOIN holidays h ON dates.date_in_period = h.holiday_date
      WHERE ww.id IS NULL  -- Not a weekend/non-working day
        AND h.id IS NULL;  -- Not a holiday
      `,
      [startDate, startDate, endDate]
    );
    
    return result[0]?.working_days || 0;
  } catch (error) {
    console.error('Error calculating working days:', error);
    throw error;
  }
}


/**
 * @description Evaluate formula string or JSON array safely with component substitutions
 */
function evaluateFormula(payrollMap, formulaJson, calculatedComponents, detailedBreakdown = {}) {
  try {
    const formulaArray =
      typeof formulaJson === "string" ? JSON.parse(formulaJson) : formulaJson;

    if (!Array.isArray(formulaArray) || formulaArray.length === 0) {
      throw new Error("Invalid formula format - expected non-empty array");
    }
    const expressionParts = [];
    const componentValues = {};
    const usedComponentIds = new Set();
    let i = 0;

    while (i < formulaArray.length) {
      const item = formulaArray[i];
      if (item.type === "component") {
        const componentId = parseInt(item.value, 10);
        const value = calculatedComponents.get(componentId);
        const actualValue = value !== null && value !== undefined ? value : 0;
        expressionParts.push(actualValue.toString());
        componentValues[`Component_${componentId}`] = actualValue;
        usedComponentIds.add(componentId);
      } else if (item.type === "number") {
        let numberString = item.value;
        while (
          i + 1 < formulaArray.length &&
          formulaArray[i + 1].type === "number"
        ) {
          i++;
          numberString += formulaArray[i].value;
        }
        expressionParts.push(numberString);
      } else if (item.type === "operator" || item.type === "parenthesis") {
        expressionParts.push(item.value);
      } else {
        expressionParts.push(item.value);
      }
      i++;
    }

    const expression = expressionParts.join(" ");
    if (!expression || expression.trim() === "") {
      throw new Error("Generated expression is empty");
    }

    // console.log(`Evaluating formula expression: ${expression}`);

    const value = evaluate(expression);
    const finalValue = parseFloat(value) || 0;

    return {
      value: finalValue,
      breakdown: {
        source: "Custom Formula Evaluation",
        raw_formula_array: formulaArray,
        parsed_expression: expression,
        component_values_used: componentValues,
        used_component_ids: Array.from(usedComponentIds),
        result: finalValue,
        calculation_steps: `Formula: ${JSON.stringify(
          formulaArray
        )} → Expression: ${expression} → Result: ${finalValue}`,
        ...detailedBreakdown,
      },
    };
  } catch (e) {
    console.error(`Formula evaluation error:`, e);
    console.error(`Formula JSON:`, formulaJson);

    return {
      value: 0,
      breakdown: {
        source: "Custom Formula Evaluation",
        error: e.message,
        raw_formula: formulaJson,
        error_details: {
          name: e.name,
          message: e.message,
          stack: e.stack,
        },
      },
    };
  }
}

async function getEmployeeShiftDetails(connection, employeeId, startDate, endDate) {
  try {
    const [shiftData] = await connection.query(
      `
      SELECT s.scheduled_hours, s.name as shift_name, s.from_time, s.to_time, s.id as shift_id
      FROM user u
      JOIN shifts s ON u.shift = s.id
      WHERE u.id = ?
      `,
      [employeeId]
    );

    if (!shiftData || !shiftData[0]) {
      throw new Error(`No shift data found for employee ${employeeId}`);
    }

    return {
      shift_id: shiftData[0].shift_id,
      scheduled_hours: parseFloat(shiftData[0].scheduled_hours) || 8,
      shift_name: shiftData[0].shift_name || "Unknown Shift",
      from_time: shiftData[0].from_time,
      to_time: shiftData[0].to_time,
    };
  } catch (error) {
    console.error(`Error fetching shift details for employee ${employeeId}:`, error);
    throw error;
  }
}

// async function getDetailedAttendanceData(connection, employeeId, startDate, endDate) {
//   try {
//     const [attendanceData] = await connection.query(
//       `
//       SELECT 
//           ar.id as attendance_id,
//           ar.attendance_date,
//           COALESCE(ar.hours_worked, 0) as hours_worked,
//           ar.attendance_status,
//           COALESCE(s.scheduled_hours, 8) as shift_hours,
//           s.name as shift_name,
//           CASE 
//               WHEN eor.id IS NOT NULL THEN GREATEST(0, COALESCE(ar.hours_worked, 0) - COALESCE(eor.overtime_hours, 0))
//               ELSE COALESCE(ar.hours_worked, 0)
//           END as regular_hours_only,
//           COALESCE(eor.overtime_hours, 0) as overtime_hours,
//           eor.overtime_type,
//           eor.status as overtime_status
//       FROM attendance_record ar
//       JOIN shifts s ON ar.shift = s.id
//       LEFT JOIN employee_overtime_records eor ON ar.id = eor.attendance_record_id 
//           AND eor.status = 'approved'
//       WHERE ar.employee_id = ? 
//       AND ar.attendance_date BETWEEN ? AND ?
//       ORDER BY ar.attendance_date
//       `,
//       [employeeId, startDate, endDate]
//     );

async function getDetailedAttendanceData(connection, employeeId, startDate, endDate) {
  try {
    const [attendanceData] = await connection.query(
      `
      SELECT 
          ar.id as attendance_id,
          ar.attendance_date,
          COALESCE(ar.hours_worked, 0) as hours_worked,
          ar.attendance_status,
          COALESCE(s.scheduled_hours, 8) as shift_hours,
          s.name as shift_name,
          CASE 
              -- For Leave status, count scheduled hours as worked (paid leave)
              WHEN ar.attendance_status = 'Leave' THEN COALESCE(s.scheduled_hours, 8)
              -- For Present/Half-Day, subtract overtime from worked hours
              WHEN eor.id IS NOT NULL THEN GREATEST(0, COALESCE(ar.hours_worked, 0) - COALESCE(eor.overtime_hours, 0))
              ELSE COALESCE(ar.hours_worked, 0)
          END as regular_hours_only,
          COALESCE(eor.overtime_hours, 0) as overtime_hours,
          eor.overtime_type,
          eor.status as overtime_status
      FROM attendance_record ar
      JOIN shifts s ON ar.shift = s.id
      LEFT JOIN employee_overtime_records eor ON ar.id = eor.attendance_record_id 
          AND eor.status = 'approved'
      WHERE ar.employee_id = ? 
      AND ar.attendance_date BETWEEN ? AND ?
      ORDER BY ar.attendance_date
      `,
      [employeeId, startDate, endDate]
    );

    let totalRegularHours = 0;
    let totalWorkedHours = 0;
    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;

    const dailyBreakdown = [];

    attendanceData.forEach((record) => {
      const regularHours = parseFloat(record.regular_hours_only) || 0;
      const workedHours = parseFloat(record.hours_worked) || 0;

      totalRegularHours += regularHours;
      totalWorkedHours += workedHours;

      switch (record.attendance_status) {
        case "Present":
          presentDays++;
          break;
        case "Absent":
          absentDays++;
          break;
        case "Leave":
          leaveDays++;
          break;
        case "Half-Day":
          halfDays++;
          break;
      }

      dailyBreakdown.push({
        date: record.attendance_date,
        status: record.attendance_status,
        hours_worked: workedHours,
        regular_hours: regularHours,
        overtime_hours: parseFloat(record.overtime_hours) || 0,
        overtime_type: record.overtime_type,
        shift_name: record.shift_name,
      });
    });

    return {
      total_regular_hours: totalRegularHours,
      total_worked_hours: totalWorkedHours,
      days_worked: attendanceData.length,
      present_days: presentDays,
      absent_days: absentDays,
      leave_days: leaveDays,
      half_days: halfDays,
      daily_breakdown: dailyBreakdown,
      attendance_summary: {
        total_records: attendanceData.length,
        working_days_in_period: attendanceData.length,
      },
    };
  } catch (error) {
    console.error(`Error fetching attendance data for employee ${employeeId}:`, error);
    throw error;
  }
}

// function calculateDaysInPeriod(startDate, endDate) {
//   const start = new Date(startDate);
//   const end = new Date(endDate);
//   const diffTime = Math.abs(end - start);
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
//   return diffDays;
// }

/**
 * Helper function to calculate total days in a period
 * @param {Date} startDate - Period start date
 * @param {Date} endDate - Period end date
 * @returns {number} Number of days
 */
function calculateDaysInPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

/**
 * NEW: Recursively calculate a pro-rated component value if not already in calculatedComponents
 * This ensures dependencies across groups are calculated correctly
 */
async function calculateProratedComponentRecursive(
  componentId,
  connection,
  employeeId,
  cycle,
  structureMap,
  calculatedComponents,
  shiftDetails,
  attendanceData,
  visited = new Set()
) {
  // Return if already calculated
  if (calculatedComponents.has(componentId)) {
    return calculatedComponents.get(componentId);
  }

  // Check for circular dependencies
  if (visited.has(componentId)) {
    throw new Error(`Circular dependency detected for component ${componentId}`);
  }
  visited.add(componentId);

  const structureRule = structureMap.get(componentId);
  if (!structureRule) {
    visited.delete(componentId);
    throw new Error(`No salary structure found for component ${componentId}`);
  }

  let value = 0;
  // const daysInPeriod = calculateDaysInPeriod(cycle.start_date, cycle.end_date);
  const daysInPeriod = await calculateWorkingDaysInPeriod(connection,cycle.start_date,cycle.end_date)

  // Get component details
  const [[componentInfo]] = await connection.query(
    "SELECT id, name, type FROM payroll_components WHERE id = ?",
    [componentId]
  );

  switch (structureRule.calculation_type) {
    case "Fixed":
      const fixedMonthlyAmount = parseFloat(structureRule.value) || 0;
      
      // Special handling for Base Salary (component ID 1)
      if (componentId === 1) {
        const dailyRate = fixedMonthlyAmount / daysInPeriod;
        const hourlyRate = dailyRate / shiftDetails.scheduled_hours;
        value = hourlyRate * attendanceData.total_regular_hours;
      } else {
        // For other fixed components, prorate based on attendance
        const dailyRate = fixedMonthlyAmount / daysInPeriod;
        const attendanceRatio = attendanceData.total_regular_hours / (daysInPeriod * shiftDetails.scheduled_hours);
        value = fixedMonthlyAmount * attendanceRatio;
      }
      break;

    case "Percentage":
      const baseComponentId = structureRule.based_on_component_id;
      // Recursively calculate the base component if not available
      const baseValue = await calculateProratedComponentRecursive(
        baseComponentId,
        connection,
        employeeId,
        cycle,
        structureMap,
        calculatedComponents,
        shiftDetails,
        attendanceData,
        visited
      );
      const percentage = parseFloat(structureRule.value);
      value = (baseValue * percentage) / 100;
      break;

    case "Formula":
      const formulaArray =
        typeof structureRule.custom_formula === "string"
          ? JSON.parse(structureRule.custom_formula)
          : structureRule.custom_formula;

      // Recursively calculate all dependent components in the formula
      const tempComponents = new Map(calculatedComponents);
      for (const item of formulaArray) {
        if (item.type === "component") {
          const depCompId = parseInt(item.value, 10);
          if (!tempComponents.has(depCompId)) {
            const depValue = await calculateProratedComponentRecursive(
              depCompId,
              connection,
              employeeId,
              cycle,
              structureMap,
              tempComponents,
              shiftDetails,
              attendanceData,
              visited
            );
            tempComponents.set(depCompId, depValue);
          }
        }
      }

      const [pc] = await connection.query(`SELECT id, name FROM payroll_components`);
      const payrollMap = toIdNameMap(pc);
      const formulaResult = evaluateFormula(payrollMap, formulaArray, tempComponents, {
        component_details: { id: componentId, name: componentInfo?.name, type: componentInfo?.type },
        employee_context: { employee_id: employeeId, cycle_start: cycle.start_date, cycle_end: cycle.end_date }
      });
      value = formulaResult.value;
      break;

    default:
      visited.delete(componentId);
      throw new Error(`Unknown calculation type: ${structureRule.calculation_type} for component ${componentId}`);
  }

  calculatedComponents.set(componentId, value);
  visited.delete(componentId);
  return value;
}

// Calculate base salary prorated for attendance
// async function calculateBaseSalary(connection, employeeId, cycle, structureMap, calculatedComponents, shiftDetails, attendanceData) {
//   try {
//     const baseSalaryStructure = structureMap.get(1);
//     if (!baseSalaryStructure) {
//       throw new Error(`Base salary structure not found for employee ${employeeId}`);
//     }

//     const monthlyBaseSalary = parseFloat(baseSalaryStructure.value) || 0;
//     if (monthlyBaseSalary === 0) {
//       throw new Error(`Invalid base salary amount for employee ${employeeId}`);
//     }

//     // const daysInPeriod = calculateDaysInPeriod(cycle.start_date, cycle.end_date);
//     const daysInPeriod = await calculateWorkingDaysInPeriod(connection,cycle.start_date, cycle.end_date);
//     const dailyRate = monthlyBaseSalary / daysInPeriod;
//     const hourlyRate = dailyRate / shiftDetails.scheduled_hours;

//     const actualBaseSalary = hourlyRate * attendanceData.total_regular_hours;

//     const breakdown = {
//       source: "Employee Salary Structure + Attendance Analysis",
//       calculation_method: "Hours-based Prorated Calculation",
//       base_salary_structure: {
//         component_id: 1,
//         calculation_type: baseSalaryStructure.calculation_type,
//         monthly_amount: monthlyBaseSalary,
//       },
//       period_details: {
//         start_date: cycle.start_date,
//         end_date: cycle.end_date,
//         total_days_in_period: daysInPeriod,
//       },
//       rate_calculations: {
//         daily_rate: dailyRate,
//         daily_rate_formula: `AED ${monthlyBaseSalary} ÷ ${daysInPeriod} days = AED ${dailyRate.toFixed(2)}`,
//         hourly_rate: hourlyRate,
//         hourly_rate_formula: `AED ${dailyRate.toFixed(2)} ÷ ${shiftDetails.scheduled_hours} hours = AED ${hourlyRate.toFixed(2)}`,
//       },
//       shift_details: {
//         shift_id: shiftDetails.shift_id,
//         shift_name: shiftDetails.shift_name,
//         scheduled_hours: shiftDetails.scheduled_hours,
//         from_time: shiftDetails.from_time,
//         to_time: shiftDetails.to_time,
//       },
//       attendance_analysis: {
//         total_regular_hours: attendanceData.total_regular_hours,
//         total_worked_hours: attendanceData.total_worked_hours,
//         days_worked: attendanceData.days_worked,
//         present_days: attendanceData.present_days,
//         absent_days: attendanceData.absent_days,
//         leave_days: attendanceData.leave_days,
//         half_days: attendanceData.half_days,
//       },
//       final_calculation: {
//         formula: `AED ${hourlyRate.toFixed(2)} × ${attendanceData.total_regular_hours} hours`,
//         regular_hours_worked: attendanceData.total_regular_hours,
//         computed_amount: actualBaseSalary,
//       },
//     };

//     calculatedComponents.set(1, actualBaseSalary);

//     return {
//       component: { id: 1, name: "Base Salary", type: "earning" },
//       amount: actualBaseSalary,
//       breakdown,
//     };
//   } catch (error) {
//     console.error(`Error calculating base salary for employee ${employeeId}:`, error);
//     throw error;
//   }
// }

/**
 * Calculate base salary using working days only (excluding weekends and holidays)
 * @param {Connection} connection - Database connection
 * @param {number} employeeId - Employee ID
 * @param {Object} cycle - Payroll cycle details
 * @param {Map} structureMap - Salary structure map
 * @param {Map} calculatedComponents - Map to store calculated components
 * @param {Object} shiftDetails - Shift details
 * @param {Object} attendanceData - Attendance data
 * @returns {Promise<Object>} Calculated base salary with breakdown
 */
async function calculateBaseSalary(connection, employeeId, cycle, structureMap, calculatedComponents, shiftDetails, attendanceData) {
  try {
    // Get base salary structure (component_id = 1)
    const baseSalaryStructure = structureMap.get(1);
    if (!baseSalaryStructure) {
      throw new Error(`Base salary structure not found for employee ${employeeId}`);
    }

    // Get monthly base salary amount
    const monthlyBaseSalary = parseFloat(baseSalaryStructure.value) || 0;
    if (monthlyBaseSalary === 0) {
      throw new Error(`Invalid base salary amount for employee ${employeeId}`);
    }

    // Calculate working days (excluding weekends from work_week and holidays)
    const workingDaysInPeriod = await calculateWorkingDaysInPeriod(
      connection, 
      cycle.start_date, 
      cycle.end_date
    );
    
    if (workingDaysInPeriod === 0) {
      throw new Error(`No working days found in period for employee ${employeeId}`);
    }

    // Calculate total days (for reference)
    const totalDaysInPeriod = calculateDaysInPeriod(cycle.start_date, cycle.end_date);
    
    // Calculate rates based on WORKING DAYS only
    const dailyRate = monthlyBaseSalary / workingDaysInPeriod;
    const hourlyRate = dailyRate / shiftDetails.scheduled_hours;

    // Calculate actual base salary based on hours worked (including leave hours)
    const actualBaseSalary = hourlyRate * attendanceData.total_regular_hours;

    // Detailed breakdown for transparency
    const breakdown = {
      source: "Employee Salary Structure + Attendance Analysis",
      calculation_method: "Hours-based Prorated Calculation",
      base_salary_structure: {
        component_id: 1,
        calculation_type: baseSalaryStructure.calculation_type,
        monthly_amount: monthlyBaseSalary,
      },
      period_details: {
        start_date: cycle.start_date,
        end_date: cycle.end_date,
        total_days_in_period: totalDaysInPeriod,
        working_days_only: workingDaysInPeriod,
        excluded_days: totalDaysInPeriod - workingDaysInPeriod,
        excluded_days_note: "Weekends and public holidays excluded from calculation"
      },
      rate_calculations: {
        daily_rate: dailyRate,
        daily_rate_formula: `AED ${monthlyBaseSalary.toFixed(2)} ÷ ${workingDaysInPeriod} working days = AED ${dailyRate.toFixed(2)}`,
        hourly_rate: hourlyRate,
        hourly_rate_formula: `AED ${dailyRate.toFixed(2)} ÷ ${shiftDetails.scheduled_hours} hours = AED ${hourlyRate.toFixed(2)}`,
      },
      shift_details: {
        shift_id: shiftDetails.shift_id,
        shift_name: shiftDetails.shift_name,
        scheduled_hours: shiftDetails.scheduled_hours,
        from_time: shiftDetails.from_time,
        to_time: shiftDetails.to_time,
      },
      attendance_analysis: {
        total_regular_hours: attendanceData.total_regular_hours,
        total_worked_hours: attendanceData.total_worked_hours,
        days_worked: attendanceData.days_worked,
        present_days: attendanceData.present_days,
        absent_days: attendanceData.absent_days,
        leave_days: attendanceData.leave_days,
        leave_hours_paid: attendanceData.leave_days * shiftDetails.scheduled_hours,
        leave_hours_note: "Leave hours are included in total_regular_hours as paid time",
        half_days: attendanceData.half_days,
      },
      final_calculation: {
        formula: `AED ${hourlyRate.toFixed(2)} × ${attendanceData.total_regular_hours} hours`,
        regular_hours_worked: attendanceData.total_regular_hours,
        computed_amount: actualBaseSalary,
        note: "Regular hours include: actual worked hours + leave hours (full scheduled hours per leave day)"
      },
    };

    // Store the calculated base salary
    calculatedComponents.set(1, actualBaseSalary);

    return {
      component: { id: 1, name: "Base Salary", type: "earning" },
      amount: actualBaseSalary,
      breakdown,
    };
  } catch (error) {
    console.error(`Error calculating base salary for employee ${employeeId}:`, error);
    throw error;
  }
}

// Calculate overtime component - UNCHANGED (keeping your fixed version)
async function calculateOvertimeComponent(
  connection,
  employeeId,
  cycle,
  overtimeType,
  componentId,
  staticCalculatedComponents,
  structureMap,
  componentDetails
) {
  try {
    const [overtimeRecords] = await connection.query(
      `
      SELECT 
          eor.id,
          eor.request_date,
          COALESCE(eor.overtime_hours, 0) AS overtime_hours,
          COALESCE(eor.approved_hours, eor.overtime_hours, 0) AS approved_hours,
          eor.overtime_type,
          eor.overtime_start,
          eor.overtime_end,
          ar.attendance_date,
          s.name AS shift_name,
          COALESCE(s.scheduled_hours, 8) AS scheduled_hours
      FROM employee_overtime_records eor
      JOIN attendance_record ar ON eor.attendance_record_id = ar.id
      JOIN shifts s ON ar.shift = s.id
      WHERE eor.employee_id = ? 
        AND eor.status = 'approved' 
        AND eor.overtime_type = ? 
        AND eor.request_date BETWEEN ? AND ?
      ORDER BY eor.request_date
      `,
      [employeeId, overtimeType, cycle.start_date, cycle.end_date]
    );

    if (!overtimeRecords.length) {
      return null;
    }

    const totalApprovedHours = overtimeRecords.reduce(
      (sum, record) => sum + (parseFloat(record.approved_hours) || 0),
      0
    );
    if (totalApprovedHours === 0) return null;

    const overtimeStructure = structureMap.get(componentId);
    if (!overtimeStructure)
      throw new Error(`Overtime component structure not found for component ${componentId}`);

    let overtimeRatePerHour = 0;
    let breakdown = {};

    async function calculateStaticComponentRecursive(compId, visited = new Set()) {
      if (staticCalculatedComponents.has(compId)) {
        return staticCalculatedComponents.get(compId);
      }
      if (visited.has(compId)) {
        throw new Error(`Circular dependency detected in component ${compId}`);
      }
      visited.add(compId);

      const struct = structureMap.get(compId);
      if (!struct) {
        visited.delete(compId);
        throw new Error(`No salary structure found for component ${compId}`);
      }

      let val = 0;

      switch (struct.calculation_type) {
        case "Fixed":
          val = parseFloat(struct.value) || 0;
          break;

        case "Percentage":
          const baseId = struct.based_on_component_id;
          const baseVal = await calculateStaticComponentRecursive(baseId, visited);
          const pct = parseFloat(struct.value);
          val = (baseVal * pct) / 100;
          break;

        case "Formula":
          const formulaArr =
            typeof struct.custom_formula === "string"
              ? JSON.parse(struct.custom_formula)
              : struct.custom_formula;

          const depStaticVals = new Map();
          for (const item of formulaArr) {
            if (item.type === "component") {
              const depCompId = parseInt(item.value, 10);
              if (!depStaticVals.has(depCompId)) {
                const depVal = await calculateStaticComponentRecursive(depCompId, visited);
                depStaticVals.set(depCompId, depVal !== undefined ? depVal : 0);
              }
            }
          }

          const [payrollComps] = await connection.query(
            `SELECT id, name FROM payroll_components`
          );
          const payrollMap = payrollComps.reduce((map, c) => {
            map[c.id] = c.name;
            return map;
          }, {});

          const formulaResult = evaluateFormula(
            payrollMap,
            formulaArr,
            depStaticVals,
            {
              component_details: {
                id: compId,
                name: struct.name,
                type: struct.type,
              },
              employee_context: {
                employee_id: employeeId,
                cycle_start: cycle.start_date,
                cycle_end: cycle.end_date,
              },
            }
          );
          val = formulaResult.value;
          break;

        default:
          visited.delete(compId);
          throw new Error(`Unknown calculation type ${struct.calculation_type} for component ${compId}`);
      }

      staticCalculatedComponents.set(compId, val);
      visited.delete(compId);
      return val;
    }

    switch (overtimeStructure.calculation_type) {
      case "Fixed":
        overtimeRatePerHour = parseFloat(overtimeStructure.value) || 0;
        breakdown = {
          source: "Employee Salary Structure",
          calculation_type: "Fixed Rate Per Hour",
          overtime_details: {
            type: overtimeType,
            component_id: componentId,
            component_name: componentDetails.name,
            total_approved_hours: totalApprovedHours,
            fixed_rate_per_hour: overtimeRatePerHour,
          },
          final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
          overtime_records: overtimeRecords.map((record) => ({
            date: record.request_date,
            approved_hours: record.approved_hours,
            shift_name: record.shift_name,
          })),
        };
        break;

      case "Percentage":
        const baseComponentId = overtimeStructure.based_on_component_id;
        const baseValue = await calculateStaticComponentRecursive(baseComponentId);
        const percentage = parseFloat(overtimeStructure.value);
        const [[baseComponent]] = await connection.query(
          "SELECT name, type FROM payroll_components WHERE id = ?",
          [baseComponentId]
        );
        overtimeRatePerHour = (baseValue * percentage) / 100;
        breakdown = {
          source: "Employee Salary Structure",
          calculation_type: "Percentage Based Rate",
          overtime_details: {
            type: overtimeType,
            component_id: componentId,
            component_name: componentDetails.name,
            total_approved_hours: totalApprovedHours,
          },
          base_component: {
            id: baseComponentId,
            name: baseComponent?.name || `Component ${baseComponentId}`,
            value: baseValue,
          },
          percentage_calculation: {
            percentage: percentage,
            formula: `(AED ${baseValue.toFixed(2)} x ${percentage}%) ÷ 100 = AED ${overtimeRatePerHour.toFixed(2)} per hour`,
          },
          final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
          overtime_records: overtimeRecords.map((record) => ({
            date: record.request_date,
            approved_hours: record.approved_hours,
            shift_name: record.shift_name,
          })),
        };
        break;

      case "Formula":
        const formulaArray =
          typeof overtimeStructure.custom_formula === "string"
            ? JSON.parse(overtimeStructure.custom_formula)
            : overtimeStructure.custom_formula;

        const filteredStaticComponents = new Map();
        for (const item of formulaArray) {
          if (item.type === "component") {
            const compId = parseInt(item.value, 10);
            if (!filteredStaticComponents.has(compId)) {
              const val = await calculateStaticComponentRecursive(compId);
              filteredStaticComponents.set(compId, val !== undefined ? val : 0);
            }
          }
        }

        const [payrollComps] = await connection.query(
          `SELECT id, name FROM payroll_components`
        );
        const payrollMap = payrollComps.reduce((map, c) => {
          map[c.id] = c.name;
          return map;
        }, {});

        const formulaResult = evaluateFormula(
          payrollMap,
          formulaArray,
          filteredStaticComponents,
          {
            overtime_component_id: componentId,
            overtime_type: overtimeType,
            calculation_context: "Overtime Rate Per Hour",
          }
        );
        overtimeRatePerHour = formulaResult.value || 0;
        breakdown = {
          ...formulaResult.breakdown,
          source: "Employee Salary Structure",
          calculation_type: "Custom Formula",
          overtime_details: {
            type: overtimeType,
            component_id: componentId,
            component_name: componentDetails.name,
            total_approved_hours: totalApprovedHours,
            per_hour_rate: overtimeRatePerHour,
          },
          final_calculation: `AED ${
            overtimeRatePerHour.toFixed(2)
          } × ${totalApprovedHours} hours = AED ${(
            overtimeRatePerHour * totalApprovedHours
          ).toFixed(2)}`,
          overtime_records: overtimeRecords.map((record) => ({
            date: record.request_date,
            approved_hours: record.approved_hours,
            shift_name: record.shift_name,
          })),
        };
        break;

      default:
        throw new Error(
          `Unknown calculation type: ${overtimeStructure.calculation_type} for overtime component ${componentId}`
        );
    }

    const overtimeAmount = overtimeRatePerHour * totalApprovedHours;
    return { amount: overtimeAmount, breakdown };
  } catch (error) {
    console.error(
      `Error calculating ${overtimeType} overtime for employee ${employeeId}:`,
      error
    );
    return {
      amount: 0,
      breakdown: {
        source: "Overtime Calculation Error",
        error: error.message,
        overtime_type: overtimeType,
        component_id: componentId,
      },
    };
  }
}

// UPDATED: Calculate other structure components with recursive dependency resolution
async function calculateStructureComponent(component, structureMap, calculatedComponents, employeeId, cycle, connection, shiftDetails, attendanceData) {
  try {
    // Use the recursive calculator which handles cross-group dependencies
    const value = await calculateProratedComponentRecursive(
      component.id,
      connection,
      employeeId,
      cycle,
      structureMap,
      calculatedComponents,
      shiftDetails,
      attendanceData
    );

    const structureRule = structureMap.get(component.id);
    const daysInPeriod = calculateDaysInPeriod(cycle.start_date, cycle.end_date);

    let breakdown = {
      source: "Employee Salary Structure",
      calculation_type: structureRule.calculation_type,
      component_details: { id: component.id, name: component.name, type: component.type },
      structure_rule: {
        calculation_type: structureRule.calculation_type,
        configured_value: structureRule.value,
      },
      prorated_for_attendance: true,
      calculated_amount: value,
      total_days_in_period: daysInPeriod,
      attendance_hours: attendanceData.total_regular_hours,
    };

    // Add specific breakdown details based on calculation type
    if (structureRule.calculation_type === "Percentage") {
      const baseComponentId = structureRule.based_on_component_id;
      const baseValue = calculatedComponents.get(baseComponentId);
      const [[baseComponent]] = await connection.query(
        "SELECT name, type FROM payroll_components WHERE id = ?",
        [baseComponentId]
      );
      breakdown.percentage_calculation = {
        percentage: parseFloat(structureRule.value),
        based_on_component: {
          id: baseComponentId,
          name: baseComponent.name,
          current_value: baseValue,
        },
        formula: `(${baseValue} × ${structureRule.value}%) / 100 = ${value}`,
      };
    } else if (structureRule.calculation_type === "Formula") {
      const [pc] = await connection.query(`SELECT id, name FROM payroll_components`);
      const payrollMap = toIdNameMap(pc);
      breakdown.formula_evaluation = {
        raw_formula: structureRule.custom_formula,
        component_map: Object.fromEntries(
          Array.from(calculatedComponents.entries()).map(([id, val]) => [
            payrollMap[id] || `Component_${id}`,
            val,
          ])
        ),
      };
    }

    return { component, amount: value, breakdown };
  } catch (error) {
    console.error(`Error calculating component ${component.id} (${component.name}):`, error);
    throw error;
  }
}

// Topological sort - UNCHANGED
function topologicalSortComponents(components, structureMap) {
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(componentId) {
    if (visited.has(componentId)) return;
    if (visiting.has(componentId)) {
      throw new Error(`Circular dependency detected involving component ${componentId}`);
    }
    visiting.add(componentId);
    const structure = structureMap.get(componentId);
    if (structure) {
      if (structure.calculation_type === 'Percentage' && structure.based_on_component_id) {
        visit(structure.based_on_component_id);
      } else if (structure.calculation_type === 'Formula' && structure.custom_formula) {
        try {
          const formulaArray = typeof structure.custom_formula === 'string' ? JSON.parse(structure.custom_formula) : structure.custom_formula;
          formulaArray.forEach(item => {
            if (item.type === 'component') {
              const depId = parseInt(item.value, 10);
              if (depId !== componentId) {
                visit(depId);
              }
            }
          });
        } catch (e) {
          console.warn(`Could not parse formula for component ${componentId}:`, e);
        }
      }
    }
    visiting.delete(componentId);
    visited.add(componentId);
    sorted.push(componentId);
  }

  components.forEach(comp => visit(comp.id));
  return sorted;
}

exports.calculateEmployeePayslip = async (connection, employeeId, componentsToProcess, cycle) => {
  const earnings = [];
  const deductions = [];
  const processedItems = [];
  const componentIdsInRun = new Set(componentsToProcess.map((c) => c.id));

  // // console.log("Components to process:", Array.from(componentIdsInRun));

  try {
    const [[employee]] = await connection.query(
      `SELECT id, first_name, last_name, joining_date, is_active, is_payroll_exempt, shift
       FROM user WHERE id = ? AND is_active = 1 AND is_payroll_exempt = 0`,
      [employeeId]
    );
    if (!employee) throw new Error(`Employee ${employeeId} is not eligible or doesn't exist`);

    const [structure] = await connection.query(
      `SELECT pc.id, pc.name, pc.type, ess.* 
       FROM employee_salary_structure ess 
       JOIN payroll_components pc ON ess.component_id = pc.id 
       WHERE ess.employee_id = ?`,
      [employeeId]
    );
    if (!structure.length) throw new Error(`No salary structure for employee ${employeeId}`);

    const structureMap = new Map(structure.map(item => [item.component_id, item]));

    const shiftDetails = await getEmployeeShiftDetails(connection, employeeId, cycle.start_date, cycle.end_date);
    const attendanceData = await getDetailedAttendanceData(connection, employeeId, cycle.start_date, cycle.end_date);

    // staticCalculatedComponents: full monthly values for overtime calculations only
    // calculatedComponents: pro-rated values for actual payroll
    const staticCalculatedComponents = new Map();
    const calculatedComponents = new Map();

    // Setup static components for overtime reference
    const baseSalaryStructure = structureMap.get(1);
    if (baseSalaryStructure) staticCalculatedComponents.set(1, parseFloat(baseSalaryStructure.value) || 0);

    structure.filter(s => s.calculation_type === 'Fixed').forEach(struct => {
      staticCalculatedComponents.set(struct.component_id, parseFloat(struct.value) || 0);
    });

    // console.log("Static components for overtime reference:", Array.from(staticCalculatedComponents.entries()));

    // Calculate pro-rated base salary
    if (componentIdsInRun.has(1)) {
      const baseSalaryResult = await calculateBaseSalary(connection, employeeId, cycle, structureMap, calculatedComponents, shiftDetails, attendanceData);
      if (baseSalaryResult) {
        earnings.push({
          component_id: 1,
          component_name: "Base Salary",
          amount: baseSalaryResult.amount,
          calculation_breakdown: JSON.stringify(baseSalaryResult.breakdown),
        });
      }
    }

    // Calculate overtime (unchanged - uses static values)
    if (componentIdsInRun.has(5)) {
      const otResult = await calculateOvertimeComponent(connection, employeeId, cycle, 'regular', 5, staticCalculatedComponents, structureMap, { name: 'Overtime (Regular)', type: 'earning' });
      if (otResult && otResult.amount > 0) {
        calculatedComponents.set(5, otResult.amount);
        earnings.push({
          component_id: 5,
          component_name: 'Overtime (Regular)',
          amount: otResult.amount,
          calculation_breakdown: JSON.stringify(otResult.breakdown),
        });
      }
    }
    if (componentIdsInRun.has(6)) {
      const holidayOtResult = await calculateOvertimeComponent(connection, employeeId, cycle, 'holiday', 6, staticCalculatedComponents, structureMap, { name: 'Overtime (Holiday)', type: 'earning' });
      if (holidayOtResult && holidayOtResult.amount > 0) {
        calculatedComponents.set(6, holidayOtResult.amount);
        earnings.push({
          component_id: 6,
          component_name: 'Overtime (Holiday)',
          amount: holidayOtResult.amount,
          calculation_breakdown: JSON.stringify(holidayOtResult.breakdown),
        });
      }
    }

    // Calculate other components with recursive dependency resolution
    const otherComps = componentsToProcess.filter(c => ![1, 5, 6, 97, 98, 99].includes(c.id));
    let sortedIds;
    try {
      sortedIds = topologicalSortComponents(otherComps, structureMap);
    } catch (e) {
      console.error("Topological sort error: ", e);
      sortedIds = otherComps.map(c => c.id);
    }

    for (const compId of sortedIds) {
      const comp = otherComps.find(c => c.id === compId);
      if (!comp) continue;

      try {
        const result = await calculateStructureComponent(
          comp,
          structureMap,
          calculatedComponents,
          employeeId,
          cycle,
          connection,
          shiftDetails,
          attendanceData
        );
        if (result) {
          const detail = {
            component_id: comp.id,
            component_name: comp.name,
            amount: result.amount,
            calculation_breakdown: JSON.stringify(result.breakdown),
          };
          if (comp.type === 'earning') earnings.push(detail);
          else deductions.push(detail);
        }
      } catch (err) {
        console.error(`Error calculating component ${comp.id} (${comp.name}): `, err);
        const errDetail = {
          component_id: comp.id,
          component_name: comp.name,
          amount: 0,
          calculation_breakdown: JSON.stringify({ source: 'Calculation Error', error: err.message, component_id: comp.id }),
        };
        if (comp.type === 'earning') earnings.push(errDetail);
        else deductions.push(errDetail);
      }
    }

    // Loan deductions (unchanged)
    if (componentIdsInRun.has(97)) {
      // console.log("Processing loan deductions");
      const [dueLoans] = await connection.query(
        `
        SELECT 
            las.id as schedule_id, 
            las.emi_amount, 
            las.principal_component,
            las.interest_component,
            las.due_date,
            las.loan_application_id,
            la.application_id_text,
            lt.name as loan_type,
            lt.interest_rate
        FROM loan_amortization_schedule las
        JOIN loan_applications la ON las.loan_application_id = la.id
        JOIN loan_types lt ON la.loan_type_id = lt.id
        WHERE la.employee_id = ? 
        AND la.status = 'Disbursed'
        AND las.status = 'Pending'
        AND las.due_date <= ?
        ORDER BY las.due_date
        `,
        [employeeId, cycle.end_date]
      );

      for (const loan of dueLoans) {
        const breakdown = {
          source: "Loan Management System",
          deduction_type: "Loan EMI",
          loan_details: {
            application_id: loan.loan_application_id,
            application_number: loan.application_id_text,
            loan_type: loan.loan_type,
            interest_rate: loan.interest_rate,
            due_date: loan.due_date,
          },
          schedule_details: {
            schedule_id: loan.schedule_id,
            total_emi: loan.emi_amount,
            principal_component: loan.principal_component,
            interest_component: loan.interest_component,
            breakdown_formula: `AED ${loan.principal_component} (Principal) + AED ${loan.interest_component} (Interest) = AED ${loan.emi_amount}`,
          },
          computed_value: loan.emi_amount,
        };

        deductions.push({
          component_id: 97,
          component_name: `Loan EMI - ${loan.loan_type}`,
          amount: loan.emi_amount,
          calculation_breakdown: JSON.stringify(breakdown),
        });

        processedItems.push({
          item_type: "loan_emi",
          item_id: loan.schedule_id,
        });


        // await connection.query(
        //   "UPDATE loan_amortization_schedule SET status = 'Paid' WHERE id = ?",
        //   [loan.schedule_id]
        // );
      }
    }

    // // HR Case deductions (unchanged)
    if (componentIdsInRun.has(98)) {
      // console.log("Processing HR case deductions");
      const [hrCases] = await connection.query(
        `
        SELECT 
            hc.id,
            hc.case_id_text,
            hc.title,
            hc.deduction_amount,
            hc.created_at,
            cc.name as category_name,
            u.first_name as raised_by_name
        FROM hr_cases hc
        JOIN case_categories cc ON hc.category_id = cc.id
        JOIN user u ON hc.raised_by = u.id
        WHERE hc.employee_id = ? 
        AND hc.status = 'Approved' 
        AND hc.is_deduction_synced = 1
        `,
        [employeeId]
      );

      for (const hrCase of hrCases) {
        const breakdown = {
          source: "HR Case Management System",
          deduction_type: "HR Case Deduction",
          case_details: {
            case_id: hrCase.id,
            case_number: hrCase.case_id_text,
            case_title: hrCase.title,
            category: hrCase.category_name,
            raised_by: hrCase.raised_by_name,
            case_date: hrCase.created_at,
          },
          deduction_details: {
            approved_amount: hrCase.deduction_amount,
            deduction_reason: `HR Case: ${hrCase.title}`,
          },
          computed_value: hrCase.deduction_amount,
        };

        deductions.push({
          component_id: 98,
          component_name: `HR Case: ${hrCase.title}`,
          amount: hrCase.deduction_amount,
          calculation_breakdown: JSON.stringify(breakdown),
        });

        processedItems.push({
          item_type: "hr_case",
          item_id: hrCase.id,
        });

        // await connection.query(
        //   "UPDATE hr_cases SET status = 'Closed' WHERE id = ?",
        //   [hrCase.id]
        // );
      }
    }

    // // Expense reimbursements (unchanged)
    if (componentIdsInRun.has(99)) {
      // console.log("Processing expense reimbursements");
      const [expenses] = await connection.query(
        `
        SELECT 
            ec.id, 
            ec.title, 
            ec.amount, 
            ec.expense_date, 
            ec.approval_date,
            exc.name AS category_name,
            u.first_name AS approved_by_name
        FROM expense_claims ec
        JOIN expense_categories exc ON ec.category_id = exc.id
        LEFT JOIN user u ON u.id = ec.approved_by
        WHERE ec.employee_id = ? 
        AND ec.status = 'Processed'
        AND ec.reimbursement_method = 'Payroll'
        AND ec.reimbursed_in_payroll_id IS NULL
        ORDER BY ec.approval_date DESC
        `,
        [employeeId]
      );

      for (const expense of expenses) {
        const breakdown = {
          source: "Expense Management System",
          reimbursement_type: "Expense Reimbursement",
          expense_details: {
            expense_id: expense.id,
            expense_title: expense.title,
            category: expense.category_name,
            expense_date: expense.expense_date,
            approval_date: expense.approval_date,
            approved_by: expense.approved_by_name,
          },
          reimbursement_details: {
            approved_amount: expense.amount,
            reimbursement_method: "Payroll",
          },
          computed_value: expense.amount,
        };

        earnings.push({
          component_id: 99,
          component_name: `Reimbursement: ${expense.title}`,
          amount: expense.amount,
          calculation_breakdown: JSON.stringify(breakdown),
        });

        processedItems.push({
          item_type: "expense_claim",
          item_id: expense.id,
        });

        // await connection.query(
        //   "UPDATE expense_claims SET reimbursed_in_payroll_id = ?, status = 'Reimbursed' WHERE id = ?",
        //   [cycle.id, expense.id]
        // );
      }
    }



    // console.log("in the engine: ",processedItems)

    return { earnings, deductions, processedItems };
  } catch (err) {
    console.error(`Payroll calculation error for employee ${employeeId}:`, err);
    throw err;
  }
};


exports.safeDeleteComponent = async (connection,payslipId,componentId) =>{
  
}