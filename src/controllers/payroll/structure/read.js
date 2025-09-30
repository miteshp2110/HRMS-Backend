// const { pool } = require('../../../db/connector');

// /**
//  * @description Gets the full salary structure for a specific employee,
//  * including the calculated monetary value for percentage-based components.
//  */
// const getEmployeeSalaryStructure = async (req, res) => {
//   const { employeeId } = req.params;
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     // ** BUG FIX: Replaced ess.value_type with ess.calculation_type **
//     const sql = `
//       SELECT
//         ess.id,
//         pc.name AS component_name,
//         pc.type AS component_type,
//         ess.calculation_type,
//         ess.value,
//         ess.custom_formula,
//         base_pc.name AS based_on_component_name,
//         pc.id AS component_id
//       FROM employee_salary_structure ess
//       JOIN payroll_components pc ON ess.component_id = pc.id
//       LEFT JOIN payroll_components base_pc ON ess.based_on_component_id = base_pc.id
//       WHERE ess.employee_id = ?
//       ORDER BY pc.type, pc.name;
//     `;
//     const [structure] = await connection.query(sql, [employeeId]);

//     // --- NEW: Calculate the actual amount for percentage-based components ---
//     const fixedComponentValues = new Map();
//     structure.forEach(component => {
//       if (component.calculation_type === 'Fixed') {
//         fixedComponentValues.set(component.component_name, parseFloat(component.value));
//       }
//     });

//     const finalStructure = structure.map(component => {
//       let calculated_amount = 0;
//       if (component.calculation_type === 'Fixed') {
//         calculated_amount = parseFloat(component.value);
//       } else if (component.calculation_type === 'Percentage') {
//         const baseValue = fixedComponentValues.get(component.based_on_component_name) || 0;
//         calculated_amount = (baseValue * parseFloat(component.value)) / 100;
//       }
//       // Note: 'Formula' types are not calculated here. They are processed during the payroll run.
//       return { ...component, calculated_amount: parseFloat(calculated_amount.toFixed(2)) };
//     });
    
//     res.status(200).json(finalStructure);
    
//   } catch (error) {
//     console.error(`Error fetching salary structure for employee ${employeeId}:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// /**
//  * @description Gets the salary structure for the currently authenticated user,
//  * but only if their 'salary_visibility' is enabled.
//  */
// const getMySalaryStructure = async (req, res) => {
//   const employeeId = req.user.id;
//   let connection;
//   try {
//     connection = await pool.getConnection();

//     const visibilitySql = 'SELECT salary_visibility FROM user WHERE id = ?';
//     const [[user]] = await connection.query(visibilitySql, [employeeId]);

//     if (!user) {
//         return res.status(404).json({ message: 'User not found.' });
//     }
//     if (!user.salary_visibility) {
//         return res.status(403).json({ message: 'Access denied. Salary visibility is not enabled for your profile.' });
//     }

//     // ** BUG FIX: Replaced ess.value_type with ess.calculation_type **
//     const structureSql = `
//       SELECT
//         ess.id,
//         pc.name AS component_name,
//         pc.type AS component_type,
//         ess.calculation_type,
//         ess.value,
//         ess.custom_formula,
//         base_pc.name AS based_on_component_name
//       FROM employee_salary_structure ess
//       JOIN payroll_components pc ON ess.component_id = pc.id
//       LEFT JOIN payroll_components base_pc ON ess.based_on_component_id = base_pc.id
//       WHERE ess.employee_id = ?
//       ORDER BY pc.type, pc.name;
//     `;
//     const [structure] = await connection.query(structureSql, [employeeId]);
    
//     const fixedComponentValues = new Map();
//     structure.forEach(component => {
//       if (component.calculation_type === 'Fixed') {
//         fixedComponentValues.set(component.component_name, parseFloat(component.value));
//       }
//     });

//     const finalStructure = structure.map(component => {
//       let calculated_amount = 0;
//       if (component.calculation_type === 'Fixed') {
//         calculated_amount = parseFloat(component.value);
//       } else if (component.calculation_type === 'Percentage') {
//         const baseValue = fixedComponentValues.get(component.based_on_component_name) || 0;
//         calculated_amount = (baseValue * parseFloat(component.value)) / 100;
//       }
//       return { ...component, calculated_amount: parseFloat(calculated_amount.toFixed(2)) };
//     });
    
//     res.status(200).json(finalStructure);
    
//   } catch (error) {
//     console.error(`Error fetching salary structure for employee ${employeeId}:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };


// module.exports = { getEmployeeSalaryStructure, getMySalaryStructure };

// /**
//  * @description Gets the list of standard parameters available for formulas.
//  */
// const getStandardParameters = async (req, res) => {
  
//     const parameters = [
//         { name: 'Days in Month', value: 'days_in_month' },
//         { name: 'Total Working Days', value: 'total_working_days' }
//     ];
//     res.status(200).json(parameters);
// };
// module.exports = { getEmployeeSalaryStructure, getMySalaryStructure ,getStandardParameters};

const { pool } = require('../../../db/connector');
const { evaluate } = require('mathjs');

/**
 * @description The core payroll calculation engine. It takes a raw salary structure
 * and calculates the final monetary value for every component, including complex formulas.
 * @param {Array} structure - The raw salary structure from the database.
 * @returns {Array} The final structure with a `calculated_amount` for every component.
 */
const calculateStructureAmounts = (structure) => {
    const calculatedComponents = new Map();

    // Pass 1: Calculate all 'Fixed' components first
    structure.forEach(component => {
        if (component.calculation_type === 'Fixed') {
            const amount = parseFloat(component.value);
            calculatedComponents.set(component.component_id, amount);
        }
    });

    // Pass 2: Calculate 'Percentage' components
    structure.forEach(component => {
        if (component.calculation_type === 'Percentage') {
            const baseComponentId = parseInt(component.based_on_component_id, 10);
            const baseValue = calculatedComponents.get(baseComponentId) || 0;
            const percentage = parseFloat(component.value);
            const amount = (baseValue * percentage) / 100;
            calculatedComponents.set(component.component_id, amount);
        }
    });
    
    // Pass 3: Calculate 'Formula' components
    structure.forEach(component => {
        if (component.calculation_type === 'Formula' && component.custom_formula) {
            try {
                const amount = evaluateFormula(component.custom_formula, calculatedComponents);
                calculatedComponents.set(component.component_id, amount);
            } catch (error) {
                console.error(`Error evaluating formula for component ${component.component_name}:`, error);
                calculatedComponents.set(component.component_id, 0);
            }
        }
    });

    // Final Pass: Map the calculated amounts back and parse the formula string
    return structure.map(component => ({
        ...component,
        // ** BUG FIX: Parse custom_formula string into a JSON object **
        custom_formula: component.custom_formula ? JSON.parse(component.custom_formula) : null,
        calculated_amount: parseFloat((calculatedComponents.get(component.component_id) || 0).toFixed(2))
    }));
};

/**
 * @description Parses and safely evaluates the JSON-based formula.
 */
function evaluateFormula(formulaJson, calculatedComponents) {
    const formulaArray = typeof formulaJson === 'string' ? JSON.parse(formulaJson) : formulaJson;

    // Step 1: Pre-process to group consecutive numbers
    const groupedArray = [];
    let currentNumber = '';
    for (const item of formulaArray) {
        if (item.type === 'number') {
            currentNumber += item.value;
        } else {
            if (currentNumber) {
                groupedArray.push({ type: 'number', value: currentNumber });
                currentNumber = '';
            }
            groupedArray.push(item);
        }
    }
    if (currentNumber) {
        groupedArray.push({ type: 'number', value: currentNumber });
    }

    // Step 2: Substitute variables and build the expression string
    const expression = groupedArray.map(item => {
        switch (item.type) {
            case 'component':
                return calculatedComponents.get(parseInt(item.value, 10)) || 0;
            case 'standard_parameter':
                // Standard parameters are not calculated in this view, only in live payroll.
                // Using 1 ensures multiplication/division doesn't break.
                return 1;
            default:
                return item.value;
        }
    }).join(' ');

    // Step 3: Safely evaluate the final mathematical expression
    return evaluate(expression);
}


/**
 * @description Gets the full salary structure for a specific employee.
 */
const getEmployeeSalaryStructure = async (req, res) => {
  const { employeeId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT
        ess.id, pc.id AS component_id, pc.name AS component_name, pc.type AS component_type,
        ess.calculation_type, ess.value, ess.custom_formula, ess.based_on_component_id,
        base_pc.name AS based_on_component_name
      FROM employee_salary_structure ess
      JOIN payroll_components pc ON ess.component_id = pc.id
      LEFT JOIN payroll_components base_pc ON ess.based_on_component_id = base_pc.id
      WHERE ess.employee_id = ?
      ORDER BY pc.id;
    `;
    const [structure] = await connection.query(sql, [employeeId]);

    const finalStructure = calculateStructureAmounts(structure);
    res.status(200).json(finalStructure);
    
  } catch (error) {
    console.error(`Error fetching salary structure for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets the salary structure for the currently authenticated user.
 */
const getMySalaryStructure = async (req, res) => {
  const employeeId = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();

    const [[user]] = await connection.query('SELECT salary_visibility FROM user WHERE id = ?', [employeeId]);
    if (!user || !user.salary_visibility) {
        return res.status(403).json({ message: 'Access denied. Salary visibility is not enabled for your profile.' });
    }

    const structureSql = `
        SELECT
            ess.id, pc.id AS component_id, pc.name AS component_name, pc.type AS component_type,
            ess.calculation_type, ess.value, ess.custom_formula, ess.based_on_component_id,
            base_pc.name AS based_on_component_name
        FROM employee_salary_structure ess
        JOIN payroll_components pc ON ess.component_id = pc.id
        LEFT JOIN payroll_components base_pc ON ess.based_on_component_id = base_pc.id
        WHERE ess.employee_id = ?
        ORDER BY pc.id;
    `;
    const [structure] = await connection.query(structureSql, [employeeId]);
    
    const finalStructure = calculateStructureAmounts(structure);
    res.status(200).json(finalStructure);
    
  } catch (error) {
    console.error(`Error fetching salary structure for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
* @description Gets the list of standard parameters available for formulas.
*/
const getStandardParameters = async (req, res) => {
 
  const parameters = [
    { name: 'Days in Month', value: 'days_in_month' },
    { name: 'Total Working Days', value: 'total_working_days' }
  ];
  res.status(200).json(parameters);
};


module.exports = { getEmployeeSalaryStructure, getMySalaryStructure, getStandardParameters };