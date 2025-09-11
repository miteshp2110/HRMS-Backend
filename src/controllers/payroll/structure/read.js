const { pool } = require('../../../db/connector');

/**
 * @description Gets the full salary structure for a specific employee,
 * including the calculated monetary value for percentage-based components.
 */
const getEmployeeSalaryStructure = async (req, res) => {
  const { employeeId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT 
        ess.id,
        pc.name AS component_name,
        pc.type AS component_type,
        ess.value_type,
        ess.value,
        base_pc.name AS based_on_component_name,
        pc.id AS component_id
      FROM employee_salary_structure ess
      JOIN payroll_components pc ON ess.component_id = pc.id
      LEFT JOIN payroll_components base_pc ON ess.based_on_component_id = base_pc.id
      WHERE ess.employee_id = ?
      ORDER BY pc.type, pc.name;
    `;
    const [structure] = await connection.query(sql, [employeeId]);

    // --- NEW: Calculate the actual amount for percentage-based components ---

    // 1. Create a map of all fixed component values for easy lookup.
    const fixedComponentValues = new Map();
    structure.forEach(component => {
      if (component.value_type === 'fixed') {
        fixedComponentValues.set(component.component_name, parseFloat(component.value));
      }
    });

    // 2. Iterate through the structure and calculate the final amount for each component.
    const finalStructure = structure.map(component => {
      if (component.value_type === 'fixed') {
        return {
          ...component,
          calculated_amount: parseFloat(component.value) // For fixed, it's just its own value
        };
      } else if (component.value_type === 'percentage') {
        const baseValue = fixedComponentValues.get(component.based_on_component_name) || 0;
        const calculatedAmount = (baseValue * parseFloat(component.value)) / 100;
        return {
          ...component,
          calculated_amount: parseFloat(calculatedAmount.toFixed(2)) // Calculate the percentage value
        };
      }
      return component; // Should not happen, but as a fallback
    });
    
    res.status(200).json(finalStructure);
    
  } catch (error) {
    console.error(`Error fetching salary structure for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets the salary structure for the currently authenticated user,
 * but only if their 'salary_visibility' is enabled.
 */
const getMySalaryStructure = async (req, res) => {
  const employeeId = req.user.id; // ID is taken securely from the token
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. First, check if the user is allowed to see their salary
    const visibilitySql = 'SELECT salary_visibility FROM user WHERE id = ?';
    const [[user]] = await connection.query(visibilitySql, [employeeId]);

    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }
    if (!user.salary_visibility) {
        return res.status(403).json({ message: 'Access denied. Salary visibility is not enabled for your profile.' });
    }

    // 2. If visibility is true, proceed to fetch the detailed structure
    const structureSql = `
      SELECT 
        ess.id,
        pc.name AS component_name,
        pc.type AS component_type,
        ess.value_type,
        ess.value,
        base_pc.name AS based_on_component_name
      FROM employee_salary_structure ess
      JOIN payroll_components pc ON ess.component_id = pc.id
      LEFT JOIN payroll_components base_pc ON ess.based_on_component_id = base_pc.id
      WHERE ess.employee_id = ?
      ORDER BY pc.type, pc.name;
    `;
    const [structure] = await connection.query(structureSql, [employeeId]);
    
    // 3. Calculate the actual amount for percentage-based components
    const fixedComponentValues = new Map();
    structure.forEach(component => {
      if (component.value_type === 'fixed') {
        fixedComponentValues.set(component.component_name, parseFloat(component.value));
      }
    });

    const finalStructure = structure.map(component => {
      if (component.value_type === 'fixed') {
        return { ...component, calculated_amount: parseFloat(component.value) };
      } else if (component.value_type === 'percentage') {
        const baseValue = fixedComponentValues.get(component.based_on_component_name) || 0;
        const calculatedAmount = (baseValue * parseFloat(component.value)) / 100;
        return { ...component, calculated_amount: parseFloat(calculatedAmount.toFixed(2)) };
      }
      return component;
    });
    
    res.status(200).json(finalStructure);
    
  } catch (error) {
    console.error(`Error fetching salary structure for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


module.exports = { getEmployeeSalaryStructure, getMySalaryStructure };