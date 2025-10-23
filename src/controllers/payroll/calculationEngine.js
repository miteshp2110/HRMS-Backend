// const { DateTime } = require("luxon");
// const { evaluate } = require("mathjs");

// // --- Enhanced and Fixed Formula Evaluation ---
// function evaluateFormula(
//   formulaJson,
//   calculatedComponents,
//   detailedBreakdown = {}
// ) {
//   try {
//     // Parse the JSON if it's a string
//     const formulaArray =
//       typeof formulaJson === "string" ? JSON.parse(formulaJson) : formulaJson;

//     if (!Array.isArray(formulaArray) || formulaArray.length === 0) {
//       throw new Error("Invalid formula format - expected non-empty array");
//     }

//     // Build expression with proper handling of numbers and components
//     const expressionParts = [];
//     const componentValues = {};
//     let i = 0;

//     while (i < formulaArray.length) {
//       const item = formulaArray[i];

//       if (item.type === "component") {
//         const componentId = parseInt(item.value, 10);
//         const value = calculatedComponents.get(componentId) || 0;
//         expressionParts.push(value.toString());
//         componentValues[`Component_${componentId}`] = value;
//       } else if (item.type === "number") {
//         // Handle consecutive number tokens (like "3", "0" should become "30")
//         let numberString = item.value;

//         // Look ahead for consecutive number tokens
//         while (
//           i + 1 < formulaArray.length &&
//           formulaArray[i + 1].type === "number"
//         ) {
//           i++;
//           numberString += formulaArray[i].value;
//         }

//         expressionParts.push(numberString);
//       } else if (item.type === "operator") {
//         expressionParts.push(item.value);
//       } else if (item.type === "parenthesis") {
//         expressionParts.push(item.value);
//       } else {
//         // Handle any other type by using its value directly
//         expressionParts.push(item.value);
//       }

//       i++;
//     }

//     const expression = expressionParts.join(" ");

//     // Validate the expression before evaluation
//     if (!expression || expression.trim() === "") {
//       throw new Error("Generated expression is empty");
//     }

//     console.log(`Evaluating formula expression: ${expression}`);

//     const value = evaluate(expression);

//     return {
//       value: parseFloat(value) || 0,
//       breakdown: {
//         source: "Custom Formula Evaluation",
//         raw_formula_array: formulaArray,
//         parsed_expression: expression,
//         component_values_used: componentValues,
//         result: parseFloat(value) || 0,
//         calculation_steps: `Formula: ${JSON.stringify(
//           formulaArray
//         )} → Expression: ${expression} → Result: ${value}`,
//         ...detailedBreakdown,
//       },
//     };
//   } catch (e) {
//     console.error(`Formula evaluation error:`, e);
//     console.error(`Formula JSON:`, formulaJson);

//     return {
//       value: 0,
//       breakdown: {
//         source: "Custom Formula Evaluation",
//         error: e.message,
//         raw_formula: formulaJson,
//         error_details: {
//           name: e.name,
//           message: e.message,
//           stack: e.stack,
//         },
//       },
//     };
//   }
// }

// // --- Enhanced Data Retrieval Functions (same as before but with better error handling) ---
// async function getEmployeeShiftDetails(
//   connection,
//   employeeId,
//   startDate,
//   endDate
// ) {
//   try {
//     const [shiftData] = await connection.query(
//       `
//             SELECT s.scheduled_hours, s.name as shift_name, s.from_time, s.to_time, s.id as shift_id
//             FROM user u
//             JOIN shifts s ON u.shift = s.id
//             WHERE u.id = ?
//         `,
//       [employeeId]
//     );

//     if (!shiftData || !shiftData[0]) {
//       throw new Error(`No shift data found for employee ${employeeId}`);
//     }

//     return {
//       shift_id: shiftData[0].shift_id,
//       scheduled_hours: parseFloat(shiftData[0].scheduled_hours) || 8, // Default to 8 hours if null
//       shift_name: shiftData[0].shift_name || "Unknown Shift",
//       from_time: shiftData[0].from_time,
//       to_time: shiftData[0].to_time,
//     };
//   } catch (error) {
//     console.error(
//       `Error fetching shift details for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// }

// async function getDetailedAttendanceData(
//   connection,
//   employeeId,
//   startDate,
//   endDate
// ) {
//   try {
//     // Get attendance records with overtime exclusion
//     const [attendanceData] = await connection.query(
//       `
//             SELECT 
//                 ar.id as attendance_id,
//                 ar.attendance_date,
//                 COALESCE(ar.hours_worked, 0) as hours_worked,
//                 ar.attendance_status,
//                 COALESCE(s.scheduled_hours, 8) as shift_hours,
//                 s.name as shift_name,
//                 CASE 
//                     WHEN eor.id IS NOT NULL THEN GREATEST(0, COALESCE(ar.hours_worked, 0) - COALESCE(eor.overtime_hours, 0))
//                     ELSE COALESCE(ar.hours_worked, 0)
//                 END as regular_hours_only,
//                 COALESCE(eor.overtime_hours, 0) as overtime_hours,
//                 eor.overtime_type,
//                 eor.status as overtime_status
//             FROM attendance_record ar
//             JOIN shifts s ON ar.shift = s.id
//             LEFT JOIN employee_overtime_records eor ON ar.id = eor.attendance_record_id 
//                 AND eor.status = 'approved'
//             WHERE ar.employee_id = ? 
//             AND ar.attendance_date BETWEEN ? AND ?
//             ORDER BY ar.attendance_date
//         `,
//       [employeeId, startDate, endDate]
//     );

//     // Calculate totals with null safety
//     let totalRegularHours = 0;
//     let totalWorkedHours = 0;
//     let presentDays = 0;
//     let absentDays = 0;
//     let leaveDays = 0;
//     let halfDays = 0;

//     const dailyBreakdown = [];

//     attendanceData.forEach((record) => {
//       const regularHours = parseFloat(record.regular_hours_only) || 0;
//       const workedHours = parseFloat(record.hours_worked) || 0;

//       totalRegularHours += regularHours;
//       totalWorkedHours += workedHours;

//       switch (record.attendance_status) {
//         case "Present":
//           presentDays++;
//           break;
//         case "Absent":
//           absentDays++;
//           break;
//         case "Leave":
//           leaveDays++;
//           break;
//         case "Half-Day":
//           halfDays++;
//           break;
//       }

//       dailyBreakdown.push({
//         date: record.attendance_date,
//         status: record.attendance_status,
//         hours_worked: workedHours,
//         regular_hours: regularHours,
//         overtime_hours: parseFloat(record.overtime_hours) || 0,
//         overtime_type: record.overtime_type,
//         shift_name: record.shift_name,
//       });
//     });

//     return {
//       total_regular_hours: totalRegularHours,
//       total_worked_hours: totalWorkedHours,
//       days_worked: attendanceData.length,
//       present_days: presentDays,
//       absent_days: absentDays,
//       leave_days: leaveDays,
//       half_days: halfDays,
//       daily_breakdown: dailyBreakdown,
//       attendance_summary: {
//         total_records: attendanceData.length,
//         working_days_in_period: attendanceData.length,
//       },
//     };
//   } catch (error) {
//     console.error(
//       `Error fetching attendance data for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// }

// // --- Enhanced Base Salary Calculation ---
// async function calculateBaseSalary(
//   connection,
//   employeeId,
//   cycle,
//   structureMap,
//   calculatedComponents
// ) {
//   try {
//     const baseSalaryStructure = structureMap.get(1);
//     if (!baseSalaryStructure) {
//       throw new Error(
//         `Base salary structure not found for employee ${employeeId}`
//       );
//     }

//     const monthlyBaseSalary = parseFloat(baseSalaryStructure.value) || 0;
//     if (monthlyBaseSalary === 0) {
//       throw new Error(`Invalid base salary amount for employee ${employeeId}`);
//     }

//     const dailyRate = monthlyBaseSalary / 30; // Standard 30-day calculation

//     // Get detailed shift information
//     const shiftDetails = await getEmployeeShiftDetails(
//       connection,
//       employeeId,
//       cycle.start_date,
//       cycle.end_date
//     );
//     const hourlyRate = dailyRate / shiftDetails.scheduled_hours;

//     // Get detailed attendance data
//     const attendanceData = await getDetailedAttendanceData(
//       connection,
//       employeeId,
//       cycle.start_date,
//       cycle.end_date
//     );

//     // Calculate actual base salary (excluding overtime hours)
//     const actualBaseSalary = hourlyRate * attendanceData.total_regular_hours;

//     const breakdown = {
//       source: "Employee Salary Structure + Attendance Analysis",
//       calculation_method: "Hours-based Prorated Calculation",
//       base_salary_structure: {
//         component_id: 1,
//         calculation_type: baseSalaryStructure.calculation_type,
//         monthly_amount: monthlyBaseSalary,
//       },
//       rate_calculations: {
//         daily_rate: dailyRate,
//         daily_rate_formula: `₹${monthlyBaseSalary} ÷ 30 days = ₹${dailyRate.toFixed(
//           2
//         )}`,
//         hourly_rate: hourlyRate,
//         hourly_rate_formula: `₹${dailyRate.toFixed(2)} ÷ ${
//           shiftDetails.scheduled_hours
//         } hours = ₹${hourlyRate.toFixed(2)}`,
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
//         working_days_in_period:
//           attendanceData.attendance_summary.working_days_in_period,
//       },
//       final_calculation: {
//         formula: `₹${hourlyRate.toFixed(2)} × ${
//           attendanceData.total_regular_hours
//         } hours`,
//         regular_hours_worked: attendanceData.total_regular_hours,
//         computed_amount: actualBaseSalary,
//       },
//       payroll_period: {
//         start_date: cycle.start_date,
//         end_date: cycle.end_date,
//       },
//     };

//     calculatedComponents.set(1, actualBaseSalary);

//     return {
//       component: { id: 1, name: "Base Salary", type: "earning" },
//       amount: actualBaseSalary,
//       breakdown,
//     };
//   } catch (error) {
//     console.error(
//       `Error calculating base salary for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// }

// // --- Enhanced Overtime Calculation ---
// async function calculateOvertimeComponent(
//   connection,
//   employeeId,
//   cycle,
//   overtimeType,
//   componentId,
//   calculatedComponents,
//   structureMap
// ) {
//   try {
//     // Get approved overtime records
//     const [overtimeRecords] = await connection.query(
//       `
//             SELECT 
//                 eor.id,
//                 eor.request_date,
//                 COALESCE(eor.overtime_hours, 0) as overtime_hours,
//                 COALESCE(eor.approved_hours, eor.overtime_hours, 0) as approved_hours,
//                 eor.overtime_type,
//                 eor.overtime_start,
//                 eor.overtime_end,
//                 ar.attendance_date,
//                 s.name as shift_name,
//                 COALESCE(s.scheduled_hours, 8) as scheduled_hours
//             FROM employee_overtime_records eor
//             JOIN attendance_record ar ON eor.attendance_record_id = ar.id
//             JOIN shifts s ON ar.shift = s.id
//             WHERE eor.employee_id = ? 
//             AND eor.status = 'approved' 
//             AND eor.overtime_type = ? 
//             AND eor.request_date BETWEEN ? AND ?
//             ORDER BY eor.request_date
//         `,
//       [employeeId, overtimeType, cycle.start_date, cycle.end_date]
//     );

//     if (!overtimeRecords.length) {
//       return null; // No overtime records found
//     }

//     const totalApprovedHours = overtimeRecords.reduce((sum, record) => {
//       return sum + (parseFloat(record.approved_hours) || 0);
//     }, 0);

//     if (totalApprovedHours === 0) {
//       return null; // No approved hours
//     }

//     // Get overtime component structure
//     const overtimeStructure = structureMap.get(componentId);
//     if (!overtimeStructure) {
//       throw new Error(
//         `Overtime component structure not found for component ${componentId}`
//       );
//     }

//     let overtimeAmount = 0;
//     let breakdown = {};

//     if (
//       overtimeStructure.custom_formula &&
//       overtimeStructure.custom_formula !== "[]"
//     ) {
//       // Use custom formula - evaluate per hour rate
//       const formulaResult = evaluateFormula(
//         overtimeStructure.custom_formula,
//         calculatedComponents,
//         {
//           overtime_component_id: componentId,
//           overtime_type: overtimeType,
//           calculation_context: "Overtime Rate Per Hour",
//         }
//       );

//       const perHourRate = formulaResult.value || 0;
//       overtimeAmount = perHourRate * totalApprovedHours;

//       breakdown = {
//         ...formulaResult.breakdown,
//         overtime_details: {
//           type: overtimeType,
//           component_id: componentId,
//           total_approved_hours: totalApprovedHours,
//           per_hour_rate: perHourRate,
//           final_calculation: `₹${perHourRate.toFixed(
//             2
//           )} × ${totalApprovedHours} hours = ₹${overtimeAmount.toFixed(2)}`,
//         },
//         overtime_records: overtimeRecords.map((record) => ({
//           date: record.request_date,
//           approved_hours: record.approved_hours,
//           shift_name: record.shift_name,
//         })),
//         computed_amount: overtimeAmount,
//       };
//     } else {
//       // Fallback standard calculation
//       const baseSalary = calculatedComponents.get(1) || 0;
//       const shiftDetails = await getEmployeeShiftDetails(
//         connection,
//         employeeId,
//         cycle.start_date,
//         cycle.end_date
//       );

//       const dailyRate = baseSalary / 30;
//       const hourlyRate = dailyRate / shiftDetails.scheduled_hours;
//       const multiplier = overtimeType === "holiday" ? 2.0 : 1.5;
//       const overtimeRate = hourlyRate * multiplier;

//       overtimeAmount = totalApprovedHours * overtimeRate;

//       breakdown = {
//         source: "Standard Overtime Calculation (Fallback)",
//         overtime_type: overtimeType,
//         multiplier: multiplier,
//         base_calculations: {
//           base_salary: baseSalary,
//           daily_rate: dailyRate,
//           hourly_rate: hourlyRate,
//           overtime_rate: overtimeRate,
//         },
//         total_approved_hours: totalApprovedHours,
//         final_calculation: `₹${overtimeRate.toFixed(
//           2
//         )} × ${totalApprovedHours} hours = ₹${overtimeAmount.toFixed(2)}`,
//         computed_amount: overtimeAmount,
//         warning: "Used fallback calculation - custom formula recommended",
//       };
//     }

//     return {
//       amount: overtimeAmount,
//       breakdown,
//     };
//   } catch (error) {
//     console.error(
//       `Error calculating ${overtimeType} overtime for employee ${employeeId}:`,
//       error
//     );
//     return {
//       amount: 0,
//       breakdown: {
//         source: "Overtime Calculation Error",
//         error: error.message,
//         overtime_type: overtimeType,
//         component_id: componentId,
//       },
//     };
//   }
// }

// // --- Enhanced Structure Component Calculation ---
// async function calculateStructureComponent(
//   component,
//   structureMap,
//   calculatedComponents,
//   employeeId,
//   cycle,
//   connection
// ) {
//   const structureRule = structureMap.get(component.id);
//   if (!structureRule) {
//     throw new Error(
//       `Salary structure not found for component ${component.id} (${component.name})`
//     );
//   }

//   let value = 0;
//   let breakdown = {};

//   switch (structureRule.calculation_type) {
//     case "Fixed":
//       value = parseFloat(structureRule.value);
//       breakdown = {
//         source: "Employee Salary Structure",
//         calculation_type: "Fixed Amount",
//         component_details: {
//           id: component.id,
//           name: component.name,
//           type: component.type,
//         },
//         structure_rule: {
//           calculation_type: "Fixed",
//           configured_amount: structureRule.value,
//         },
//         computed_value: value,
//         calculation_summary: `Fixed amount as per salary structure: ₹${value}`,
//       };
//       break;

//     case "Percentage":
//       const baseComponentId = structureRule.based_on_component_id;
//       const baseValue = calculatedComponents.get(baseComponentId) || 0;
//       const percentage = parseFloat(structureRule.value);
//       value = (baseValue * percentage) / 100;

//       // Get base component details
//       const [[baseComponent]] = await connection.query(
//         "SELECT name, type FROM payroll_components WHERE id = ?",
//         [baseComponentId]
//       );

//       breakdown = {
//         source: "Employee Salary Structure",
//         calculation_type: "Percentage Based",
//         component_details: {
//           id: component.id,
//           name: component.name,
//           type: component.type,
//         },
//         structure_rule: {
//           calculation_type: "Percentage",
//           percentage: percentage,
//           based_on_component: {
//             id: baseComponentId,
//             name: baseComponent?.name || `Component ${baseComponentId}`,
//             type: baseComponent?.type,
//             current_value: baseValue,
//           },
//         },
//         calculation_details: {
//           formula: `(₹${baseValue.toFixed(2)} × ${percentage}%) ÷ 100`,
//           step_by_step: `(${baseValue.toFixed(
//             2
//           )} × ${percentage}) ÷ 100 = ${value.toFixed(2)}`,
//         },
//         computed_value: value,
//       };
//       break;

//     case "Formula":
//       const result = evaluateFormula(
//         structureRule.custom_formula,
//         calculatedComponents,
//         {
//           component_details: {
//             id: component.id,
//             name: component.name,
//             type: component.type,
//           },
//           employee_context: {
//             employee_id: employeeId,
//             cycle_start: cycle.start_date,
//             cycle_end: cycle.end_date,
//           },
//         }
//       );
//       value = result.value;
//       breakdown = {
//         ...result.breakdown,
//         source: "Employee Salary Structure",
//         calculation_type: "Custom Formula",
//       };
//       break;

//     default:
//       throw new Error(
//         `Unknown calculation type: ${structureRule.calculation_type} for component ${component.id}`
//       );
//   }

//   calculatedComponents.set(component.id, value);
//   return { component, amount: value, breakdown };
// }

// // --- Enhanced Main Calculation Engine ---
// exports.calculateEmployeePayslip = async (
//   connection,
//   employeeId,
//   componentsToProcess,
//   cycle
// ) => {
//   const earnings = [];
//   const deductions = [];
//   const processedItems = [];
//   const componentIdsInRun = new Set(componentsToProcess.map((c) => c.id));

//   console.log(componentIdsInRun)

//   try {
//     // 1. Validate employee eligibility
//     const [[employee]] = await connection.query(
//       `
//             SELECT id, first_name, last_name, joining_date, is_active, is_payroll_exempt, shift
//             FROM user WHERE id = ? AND is_active = 1 AND is_payroll_exempt = 0
//         `,
//       [employeeId]
//     );

//     if (!employee) {
//       throw new Error(
//         `Employee ${employeeId} is not eligible for payroll or does not exist`
//       );
//     }

//     // 2. Fetch and validate employee salary structure
//     const [structure] = await connection.query(
//       `
//             SELECT pc.id, pc.name, pc.type, ess.* 
//             FROM employee_salary_structure ess 
//             JOIN payroll_components pc ON ess.component_id = pc.id 
//             WHERE ess.employee_id = ?
//             ORDER BY 
//                 CASE 
//                     WHEN ess.calculation_type = 'Fixed' THEN 1
//                     WHEN ess.calculation_type = 'Percentage' THEN 2
//                     WHEN ess.calculation_type = 'Formula' THEN 3
//                 END,
//                 pc.id
//         `,
//       [employeeId]
//     );

//     if (!structure.length) {
//       throw new Error(`No salary structure found for employee ${employeeId}`);
//     }

//     const structureMap = new Map(
//       structure.map((item) => [item.component_id, item])
//     );
//     const calculatedComponents = new Map();

//     // 3. Calculate Base Salary FIRST (mandatory for all calculations)
//     if (componentIdsInRun.has(1)) {
//       const baseSalaryResult = await calculateBaseSalary(
//         connection,
//         employeeId,
//         cycle,
//         structureMap,
//         calculatedComponents
//       );
//       if (baseSalaryResult) {
//         earnings.push({
//           component_id: 1,
//           component_name: "Base Salary",
//           amount: baseSalaryResult.amount,
//           calculation_breakdown: JSON.stringify(baseSalaryResult.breakdown),
//         });
//       }
//     } else if (!calculatedComponents.has(1)) {
//       // Base salary needed for other calculations even if not in processing list
//       await calculateBaseSalary(
//         connection,
//         employeeId,
//         cycle,
//         structureMap,
//         calculatedComponents
//       );
//     }

//     // 4. Calculate Regular Overtime (Component ID 5)
//     if (componentIdsInRun.has(5)) {
//       const overtimeResult = await calculateOvertimeComponent(
//         connection,
//         employeeId,
//         cycle,
//         "regular",
//         5,
//         calculatedComponents,
//         structureMap
//       );

//       if (overtimeResult && overtimeResult.amount > 0) {
//         calculatedComponents.set(5, overtimeResult.amount);
//         earnings.push({
//           component_id: 5,
//           component_name: "Overtime (Regular)",
//           amount: overtimeResult.amount,
//           calculation_breakdown: JSON.stringify(overtimeResult.breakdown),
//         });
//       }
//     }

//     // 5. Calculate Holiday Overtime (Component ID 6)
//     if (componentIdsInRun.has(6)) {
//       const holidayOvertimeResult = await calculateOvertimeComponent(
//         connection,
//         employeeId,
//         cycle,
//         "holiday",
//         6,
//         calculatedComponents,
//         structureMap
//       );

//       if (holidayOvertimeResult && holidayOvertimeResult.amount > 0) {
//         calculatedComponents.set(6, holidayOvertimeResult.amount);
//         earnings.push({
//           component_id: 6,
//           component_name: "Overtime (Holiday)",
//           amount: holidayOvertimeResult.amount,
//           calculation_breakdown: JSON.stringify(
//             holidayOvertimeResult.breakdown
//           ),
//         });
//       }
//     }

//     // 6. Calculate other structured components
//     for (const component of componentsToProcess) {
//       // Skip base salary and overtime components (already processed)
//       if ([1, 5, 6,97,98,99].includes(component.id)) continue;

//       const result = await calculateStructureComponent(
//         component,
//         structureMap,
//         calculatedComponents,
//         employeeId,
//         cycle,
//         connection
//       );

//       if (result) {
//         const detail = {
//           component_id: component.id,
//           component_name: component.name,
//           amount: result.amount,
//           calculation_breakdown: JSON.stringify(result.breakdown),
//         };

//         if (component.type === "earning") {
//           earnings.push(detail);
//         } else {
//           deductions.push(detail);
//         }
//       }
//     }

//     // 7. Process Loan Deductions
//     if (componentIdsInRun.has(97)) {
//         console.log("Running loans deductions")
//       const [dueLoans] = await connection.query(
//         `
//     SELECT 
//         las.id as schedule_id, 
//         las.emi_amount, 
//         las.principal_component,
//         las.interest_component,
//         las.due_date,
//         las.loan_application_id,
//         la.application_id_text,
//         lt.name as loan_type,
//         lt.interest_rate
//     FROM loan_amortization_schedule las
//     JOIN loan_applications la ON las.loan_application_id = la.id
//     JOIN loan_types lt ON la.loan_type_id = lt.id
//     WHERE la.employee_id = ? 
//     AND la.status = 'Disbursed'
//     AND las.status = 'Pending'
//     AND las.due_date <= ?
//     ORDER BY las.due_date
// `,
//         [employeeId, cycle.end_date]
//       );

//       for (const loan of dueLoans) {
//         const breakdown = {
//           source: "Loan Management System",
//           deduction_type: "Loan EMI",
//           loan_details: {
//             application_id: loan.loan_application_id,
//             application_number: loan.application_id_text,
//             loan_type: loan.loan_type,
//             interest_rate: loan.interest_rate,
//             due_date: loan.due_date,
//           },
//           schedule_details: {
//             schedule_id: loan.schedule_id,
//             total_emi: loan.emi_amount,
//             principal_component: loan.principal_component,
//             interest_component: loan.interest_component,
//             breakdown_formula: `₹${loan.principal_component} (Principal) + ₹${loan.interest_component} (Interest) = ₹${loan.emi_amount}`,
//           },
//           computed_value: loan.emi_amount,
//         };

//         deductions.push({
//           component_id: null,
//           component_name: `Loan EMI - ${loan.loan_type}`,
//           amount: loan.emi_amount,
//           calculation_breakdown: JSON.stringify(breakdown),
//         });

//         processedItems.push({
//           item_type: "loan_emi",
//           item_id: loan.schedule_id,
//         });
//       }
//     }

//     // 8. Process HR Case Deductions
//     if (componentIdsInRun.has(98)) {
//         console.log("Running Case deductions")
//       const [hrCases] = await connection.query(
//         `
//             SELECT 
//                 hc.id,
//                 hc.case_id_text,
//                 hc.title,
//                 hc.deduction_amount,
//                 hc.created_at,
//                 cc.name as category_name,
//                 u.first_name as raised_by_name
//             FROM hr_cases hc
//             JOIN case_categories cc ON hc.category_id = cc.id
//             JOIN user u ON hc.raised_by = u.id
//             WHERE hc.employee_id = ? 
//             AND hc.status = 'Approved' 
//             AND hc.is_deduction_synced = 1
//         `,
//         [employeeId]
//       );

//       for (const hrCase of hrCases) {
//         const breakdown = {
//           source: "HR Case Management System",
//           deduction_type: "HR Case Deduction",
//           case_details: {
//             case_id: hrCase.id,
//             case_number: hrCase.case_id_text,
//             case_title: hrCase.title,
//             category: hrCase.category_name,
//             raised_by: hrCase.raised_by_name,
//             case_date: hrCase.created_at,
//           },
//           deduction_details: {
//             approved_amount: hrCase.deduction_amount,
//             deduction_reason: `HR Case: ${hrCase.title}`,
//           },
//           computed_value: hrCase.deduction_amount,
//         };

//         deductions.push({
//           component_id: null,
//           component_name: `HR Case: ${hrCase.title}`,
//           amount: hrCase.deduction_amount,
//           calculation_breakdown: JSON.stringify(breakdown),
//         });

//         processedItems.push({
//           item_type: "hr_case",
//           item_id: hrCase.id,
//         });
//       }
//     }

//     // 9. Process Expense Reimbursements

    
//       if(componentIdsInRun.has(99)){
//         const [expenses] = await connection.query(
//         `
//   SELECT 
//       ec.id, 
//       ec.title, 
//       ec.amount, 
//       ec.expense_date, 
//       ec.approval_date,
//       exc.name AS category_name,
//       u.first_name AS approved_by_name
//   FROM expense_claims ec
//   JOIN expense_categories exc 
//       ON ec.category_id = exc.id
//   LEFT JOIN user u   -- escape reserved keyword
//       ON u.id = ec.approved_by
//   WHERE ec.employee_id = ? 
//     AND ec.status = 'Processed'
//     AND ec.reimbursement_method = 'Payroll'
//     AND ec.reimbursed_in_payroll_id IS NULL
//   ORDER BY ec.approval_date DESC
//   `,
//         [employeeId]
//       );

//       console.log(`Expenses fetched for employee ${employeeId}:`, expenses);

//       for (const expense of expenses) {
//         try {
//           const breakdown = {
//             source: "Expense Management System",
//             reimbursement_type: "Expense Reimbursement",
//             expense_details: {
//               expense_id: expense.id,
//               expense_title: expense.title,
//               category: expense.category_name,
//               expense_date: expense.expense_date,
//               approval_date: expense.approval_date,
//               approved_by: expense.approved_by_name,
//             },
//             reimbursement_details: {
//               approved_amount: expense.amount,
//               reimbursement_method: "Payroll",
//             },
//             computed_value: expense.amount,
//           };

//           earnings.push({
//             component_id: null,
//             component_name: `Reimbursement: ${expense.title}`,
//             amount: expense.amount,
//             calculation_breakdown: JSON.stringify(breakdown),
//           });

//           console.log(
//             `Added expense id ${expense.id} to earnings with amount ${expense.amount}`
//           );

//           // Mark expense processed in payroll to avoid duplicate processing
//           // await connection.query(
//           //   "UPDATE expense_claims SET reimbursed_in_payroll_id = ? WHERE id = ?",
//           //   [cycle.id, expense.id]
//           // );
//           console.log(
//             `Marked expense id ${expense.id} reimbursed in payroll ${cycle.id}`
//           );
//         } catch (err) {
//           console.error(`Error processing expense id ${expense.id}:`, err);
//         }
//       }

//       console.log(`Total earnings after expenses: ${earnings.length}`);
//       }
    

//     return { earnings, deductions, processedItems };
//   } catch (error) {
//     console.error(
//       `Payroll calculation error for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// };


// const { DateTime } = require("luxon");
// const { evaluate } = require("mathjs");

// /**
//  * @description Enhanced formula evaluation with error handling and dependency tracking
//  */
// function evaluateFormula(
//   formulaJson,
//   calculatedComponents,
//   detailedBreakdown = {}
// ) {
//   try {
//     const formulaArray =
//       typeof formulaJson === "string" ? JSON.parse(formulaJson) : formulaJson;

//     if (!Array.isArray(formulaArray) || formulaArray.length === 0) {
//       throw new Error("Invalid formula format - expected non-empty array");
//     }

//     const expressionParts = [];
//     const componentValues = {};
//     const usedComponentIds = new Set();
//     let i = 0;

//     while (i < formulaArray.length) {
//       const item = formulaArray[i];

//       if (item.type === "component") {
//         const componentId = parseInt(item.value, 10);
//         const value = calculatedComponents.get(componentId);
        
//         // Explicit null/undefined check
//         const actualValue = (value !== null && value !== undefined) ? value : 0;
        
//         expressionParts.push(actualValue.toString());
//         componentValues[`Component_${componentId}`] = actualValue;
//         usedComponentIds.add(componentId);
//       } else if (item.type === "number") {
//         let numberString = item.value;

//         // Look ahead for consecutive number tokens
//         while (
//           i + 1 < formulaArray.length &&
//           formulaArray[i + 1].type === "number"
//         ) {
//           i++;
//           numberString += formulaArray[i].value;
//         }

//         expressionParts.push(numberString);
//       } else if (item.type === "operator") {
//         expressionParts.push(item.value);
//       } else if (item.type === "parenthesis") {
//         expressionParts.push(item.value);
//       } else {
//         expressionParts.push(item.value);
//       }

//       i++;
//     }

//     const expression = expressionParts.join(" ");

//     if (!expression || expression.trim() === "") {
//       throw new Error("Generated expression is empty");
//     }

//     console.log(`Evaluating formula expression: ${expression}`);

//     const value = evaluate(expression);
//     const finalValue = parseFloat(value) || 0;

//     return {
//       value: finalValue,
//       breakdown: {
//         source: "Custom Formula Evaluation",
//         raw_formula_array: formulaArray,
//         parsed_expression: expression,
//         component_values_used: componentValues,
//         used_component_ids: Array.from(usedComponentIds),
//         result: finalValue,
//         calculation_steps: `Formula: ${JSON.stringify(
//           formulaArray
//         )} → Expression: ${expression} → Result: ${finalValue}`,
//         ...detailedBreakdown,
//       },
//     };
//   } catch (e) {
//     console.error(`Formula evaluation error:`, e);
//     console.error(`Formula JSON:`, formulaJson);

//     return {
//       value: 0,
//       breakdown: {
//         source: "Custom Formula Evaluation",
//         error: e.message,
//         raw_formula: formulaJson,
//         error_details: {
//           name: e.name,
//           message: e.message,
//           stack: e.stack,
//         },
//       },
//     };
//   }
// }

// /**
//  * @description Get employee shift details (cached at employee level)
//  */
// async function getEmployeeShiftDetails(
//   connection,
//   employeeId,
//   startDate,
//   endDate
// ) {
//   try {
//     const [shiftData] = await connection.query(
//       `
//       SELECT s.scheduled_hours, s.name as shift_name, s.from_time, s.to_time, s.id as shift_id
//       FROM user u
//       JOIN shifts s ON u.shift = s.id
//       WHERE u.id = ?
//       `,
//       [employeeId]
//     );

//     if (!shiftData || !shiftData[0]) {
//       throw new Error(`No shift data found for employee ${employeeId}`);
//     }

//     return {
//       shift_id: shiftData[0].shift_id,
//       scheduled_hours: parseFloat(shiftData[0].scheduled_hours) || 8,
//       shift_name: shiftData[0].shift_name || "Unknown Shift",
//       from_time: shiftData[0].from_time,
//       to_time: shiftData[0].to_time,
//     };
//   } catch (error) {
//     console.error(
//       `Error fetching shift details for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// }

// /**
//  * @description Get detailed attendance data with overtime exclusion
//  */
// async function getDetailedAttendanceData(
//   connection,
//   employeeId,
//   startDate,
//   endDate
// ) {
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

//     let totalRegularHours = 0;
//     let totalWorkedHours = 0;
//     let presentDays = 0;
//     let absentDays = 0;
//     let leaveDays = 0;
//     let halfDays = 0;

//     const dailyBreakdown = [];

//     attendanceData.forEach((record) => {
//       const regularHours = parseFloat(record.regular_hours_only) || 0;
//       const workedHours = parseFloat(record.hours_worked) || 0;

//       totalRegularHours += regularHours;
//       totalWorkedHours += workedHours;

//       switch (record.attendance_status) {
//         case "Present":
//           presentDays++;
//           break;
//         case "Absent":
//           absentDays++;
//           break;
//         case "Leave":
//           leaveDays++;
//           break;
//         case "Half-Day":
//           halfDays++;
//           break;
//       }

//       dailyBreakdown.push({
//         date: record.attendance_date,
//         status: record.attendance_status,
//         hours_worked: workedHours,
//         regular_hours: regularHours,
//         overtime_hours: parseFloat(record.overtime_hours) || 0,
//         overtime_type: record.overtime_type,
//         shift_name: record.shift_name,
//       });
//     });

//     return {
//       total_regular_hours: totalRegularHours,
//       total_worked_hours: totalWorkedHours,
//       days_worked: attendanceData.length,
//       present_days: presentDays,
//       absent_days: absentDays,
//       leave_days: leaveDays,
//       half_days: halfDays,
//       daily_breakdown: dailyBreakdown,
//       attendance_summary: {
//         total_records: attendanceData.length,
//         working_days_in_period: attendanceData.length,
//       },
//     };
//   } catch (error) {
//     console.error(
//       `Error fetching attendance data for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// }

// /**
//  * @description Calculate number of days in the payroll period
//  */
// function calculateDaysInPeriod(startDate, endDate) {
//   const start = new Date(startDate);
//   const end = new Date(endDate);
//   const diffTime = Math.abs(end - start);
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
//   return diffDays;
// }

// /**
//  * @description Calculate base salary (always based on full monthly amount, not prorated)
//  */
// async function calculateBaseSalary(
//   connection,
//   employeeId,
//   cycle,
//   structureMap,
//   calculatedComponents,
//   shiftDetails,
//   attendanceData
// ) {
//   try {
//     const baseSalaryStructure = structureMap.get(1);
//     if (!baseSalaryStructure) {
//       throw new Error(
//         `Base salary structure not found for employee ${employeeId}`
//       );
//     }

//     const monthlyBaseSalary = parseFloat(baseSalaryStructure.value) || 0;
//     if (monthlyBaseSalary === 0) {
//       throw new Error(`Invalid base salary amount for employee ${employeeId}`);
//     }

//     const daysInPeriod = calculateDaysInPeriod(cycle.start_date, cycle.end_date);
//     const dailyRate = monthlyBaseSalary / daysInPeriod;
//     const hourlyRate = dailyRate / shiftDetails.scheduled_hours;

//     // Calculate prorated base salary based on attendance
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
//     console.error(
//       `Error calculating base salary for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// }

// /**
//  * @description Calculate overtime component (supports Fixed, Percentage, and Formula)
//  */
// async function calculateOvertimeComponent(
//   connection,
//   employeeId,
//   cycle,
//   overtimeType,
//   componentId,
//   staticCalculatedComponents,
//   structureMap,
//   componentDetails
// ) {
//   try {
//     // Get approved overtime records
//     const [overtimeRecords] = await connection.query(
//       `
//       SELECT 
//           eor.id,
//           eor.request_date,
//           COALESCE(eor.overtime_hours, 0) as overtime_hours,
//           COALESCE(eor.approved_hours, eor.overtime_hours, 0) as approved_hours,
//           eor.overtime_type,
//           eor.overtime_start,
//           eor.overtime_end,
//           ar.attendance_date,
//           s.name as shift_name,
//           COALESCE(s.scheduled_hours, 8) as scheduled_hours
//       FROM employee_overtime_records eor
//       JOIN attendance_record ar ON eor.attendance_record_id = ar.id
//       JOIN shifts s ON ar.shift = s.id
//       WHERE eor.employee_id = ? 
//       AND eor.status = 'approved' 
//       AND eor.overtime_type = ? 
//       AND eor.request_date BETWEEN ? AND ?
//       ORDER BY eor.request_date
//       `,
//       [employeeId, overtimeType, cycle.start_date, cycle.end_date]
//     );

//     if (!overtimeRecords.length) {
//       return null;
//     }

//     const totalApprovedHours = overtimeRecords.reduce((sum, record) => {
//       return sum + (parseFloat(record.approved_hours) || 0);
//     }, 0);

//     if (totalApprovedHours === 0) {
//       return null;
//     }

//     const overtimeStructure = structureMap.get(componentId);
//     if (!overtimeStructure) {
//       throw new Error(
//         `Overtime component structure not found for component ${componentId}`
//       );
//     }

//     let overtimeRatePerHour = 0;
//     let breakdown = {};

//     // Process based on calculation type
//     switch (overtimeStructure.calculation_type) {
//       case "Fixed":
//         // Fixed rate per hour
//         overtimeRatePerHour = parseFloat(overtimeStructure.value) || 0;
//         breakdown = {
//           source: "Employee Salary Structure",
//           calculation_type: "Fixed Rate Per Hour",
//           overtime_details: {
//             type: overtimeType,
//             component_id: componentId,
//             component_name: componentDetails.name,
//             total_approved_hours: totalApprovedHours,
//             fixed_rate_per_hour: overtimeRatePerHour,
//           },
//           final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
//           overtime_records: overtimeRecords.map((record) => ({
//             date: record.request_date,
//             approved_hours: record.approved_hours,
//             shift_name: record.shift_name,
//           })),
//         };
//         break;

//       case "Percentage":
//         // Percentage of base component
//         const baseComponentId = overtimeStructure.based_on_component_id;
//         const baseValue = staticCalculatedComponents.get(baseComponentId) || 0;
//         const percentage = parseFloat(overtimeStructure.value);
        
//         // Get base component details
//         const [[baseComponent]] = await connection.query(
//           "SELECT name, type FROM payroll_components WHERE id = ?",
//           [baseComponentId]
//         );

//         overtimeRatePerHour = (baseValue * percentage) / 100;
        
//         breakdown = {
//           source: "Employee Salary Structure",
//           calculation_type: "Percentage Based Rate",
//           overtime_details: {
//             type: overtimeType,
//             component_id: componentId,
//             component_name: componentDetails.name,
//             total_approved_hours: totalApprovedHours,
//           },
//           base_component: {
//             id: baseComponentId,
//             name: baseComponent?.name || `Component ${baseComponentId}`,
//             value: baseValue,
//           },
//           percentage_calculation: {
//             percentage: percentage,
//             formula: `(AED ${baseValue.toFixed(2)} × ${percentage}%) ÷ 100 = AED ${overtimeRatePerHour.toFixed(2)} per hour`,
//           },
//           final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
//           overtime_records: overtimeRecords.map((record) => ({
//             date: record.request_date,
//             approved_hours: record.approved_hours,
//             shift_name: record.shift_name,
//           })),
//         };
//         break;

//       case "Formula":
//         // Custom formula evaluation
//         const formulaResult = evaluateFormula(
//           overtimeStructure.custom_formula,
//           staticCalculatedComponents,
//           {
//             overtime_component_id: componentId,
//             overtime_type: overtimeType,
//             calculation_context: "Overtime Rate Per Hour",
//           }
//         );

//         overtimeRatePerHour = formulaResult.value || 0;
        
//         breakdown = {
//           ...formulaResult.breakdown,
//           source: "Employee Salary Structure",
//           calculation_type: "Custom Formula",
//           overtime_details: {
//             type: overtimeType,
//             component_id: componentId,
//             component_name: componentDetails.name,
//             total_approved_hours: totalApprovedHours,
//             per_hour_rate: overtimeRatePerHour,
//           },
//           final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
//           overtime_records: overtimeRecords.map((record) => ({
//             date: record.request_date,
//             approved_hours: record.approved_hours,
//             shift_name: record.shift_name,
//           })),
//         };
//         break;

//       default:
//         throw new Error(
//           `Unknown calculation type: ${overtimeStructure.calculation_type} for overtime component ${componentId}`
//         );
//     }

//     const overtimeAmount = overtimeRatePerHour * totalApprovedHours;

//     return {
//       amount: overtimeAmount,
//       breakdown,
//     };
//   } catch (error) {
//     console.error(
//       `Error calculating ${overtimeType} overtime for employee ${employeeId}:`,
//       error
//     );
//     return {
//       amount: 0,
//       breakdown: {
//         source: "Overtime Calculation Error",
//         error: error.message,
//         overtime_type: overtimeType,
//         component_id: componentId,
//       },
//     };
//   }
// }

// /**
//  * @description Calculate structure component (Fixed, Percentage, Formula)
//  */
// async function calculateStructureComponent(
//   component,
//   structureMap,
//   staticCalculatedComponents,
//   employeeId,
//   cycle,
//   connection
// ) {
//   const structureRule = structureMap.get(component.id);
//   if (!structureRule) {
//     throw new Error(
//       `Salary structure not found for component ${component.id} (${component.name})`
//     );
//   }

//   let value = 0;
//   let breakdown = {};

//   switch (structureRule.calculation_type) {
//     case "Fixed":
//       value = parseFloat(structureRule.value) || 0;
//       breakdown = {
//         source: "Employee Salary Structure",
//         calculation_type: "Fixed Amount",
//         component_details: {
//           id: component.id,
//           name: component.name,
//           type: component.type,
//         },
//         structure_rule: {
//           calculation_type: "Fixed",
//           configured_amount: structureRule.value,
//         },
//         computed_value: value,
//         calculation_summary: `Fixed amount as per salary structure: AED ${value}`,
//       };
//       break;

//     case "Percentage":
//       const baseComponentId = structureRule.based_on_component_id;
//       const baseValue = staticCalculatedComponents.get(baseComponentId);
      
//       if (baseValue === null || baseValue === undefined) {
//         throw new Error(
//           `Base component ${baseComponentId} not calculated yet for percentage calculation of ${component.name}`
//         );
//       }

//       const percentage = parseFloat(structureRule.value);
//       value = (baseValue * percentage) / 100;

//       // Get base component details
//       const [[baseComponent]] = await connection.query(
//         "SELECT name, type FROM payroll_components WHERE id = ?",
//         [baseComponentId]
//       );

//       breakdown = {
//         source: "Employee Salary Structure",
//         calculation_type: "Percentage Based",
//         component_details: {
//           id: component.id,
//           name: component.name,
//           type: component.type,
//         },
//         structure_rule: {
//           calculation_type: "Percentage",
//           percentage: percentage,
//           based_on_component: {
//             id: baseComponentId,
//             name: baseComponent?.name || `Component ${baseComponentId}`,
//             type: baseComponent?.type,
//             current_value: baseValue,
//           },
//         },
//         calculation_details: {
//           formula: `(AED ${baseValue.toFixed(2)} × ${percentage}%) ÷ 100`,
//           step_by_step: `(${baseValue.toFixed(2)} × ${percentage}) ÷ 100 = ${value.toFixed(2)}`,
//         },
//         computed_value: value,
//       };
//       break;

//     case "Formula":
//       const result = evaluateFormula(
//         structureRule.custom_formula,
//         staticCalculatedComponents,
//         {
//           component_details: {
//             id: component.id,
//             name: component.name,
//             type: component.type,
//           },
//           employee_context: {
//             employee_id: employeeId,
//             cycle_start: cycle.start_date,
//             cycle_end: cycle.end_date,
//           },
//         }
//       );
//       value = result.value;
//       breakdown = {
//         ...result.breakdown,
//         source: "Employee Salary Structure",
//         calculation_type: "Custom Formula",
//       };
//       break;

//     default:
//       throw new Error(
//         `Unknown calculation type: ${structureRule.calculation_type} for component ${component.id}`
//       );
//   }

//   return { component, amount: value, breakdown };
// }

// /**
//  * @description Topological sort for component dependencies
//  */
// function topologicalSortComponents(components, structureMap) {
//   const sorted = [];
//   const visited = new Set();
//   const visiting = new Set();

//   function visit(componentId) {
//     if (visited.has(componentId)) return;
//     if (visiting.has(componentId)) {
//       throw new Error(`Circular dependency detected involving component ${componentId}`);
//     }

//     visiting.add(componentId);

//     const structure = structureMap.get(componentId);
//     if (structure) {
//       // Check for dependencies
//       if (structure.calculation_type === 'Percentage' && structure.based_on_component_id) {
//         visit(structure.based_on_component_id);
//       } else if (structure.calculation_type === 'Formula' && structure.custom_formula) {
//         // Extract component IDs from formula
//         try {
//           const formulaArray = typeof structure.custom_formula === 'string' 
//             ? JSON.parse(structure.custom_formula) 
//             : structure.custom_formula;
          
//           formulaArray.forEach(item => {
//             if (item.type === 'component') {
//               const depId = parseInt(item.value, 10);
//               if (depId !== componentId) {
//                 visit(depId);
//               }
//             }
//           });
//         } catch (e) {
//           console.warn(`Could not parse formula for component ${componentId}:`, e);
//         }
//       }
//     }

//     visiting.delete(componentId);
//     visited.add(componentId);
//     sorted.push(componentId);
//   }

//   components.forEach(comp => visit(comp.id));
  
//   return sorted;
// }

// /**
//  * @description Main calculation engine
//  */
// exports.calculateEmployeePayslip = async (
//   connection,
//   employeeId,
//   componentsToProcess,
//   cycle
// ) => {
//   const earnings = [];
//   const deductions = [];
//   const processedItems = [];
//   const componentIdsInRun = new Set(componentsToProcess.map((c) => c.id));

//   console.log("Components to process:", Array.from(componentIdsInRun));

//   try {
//     // 1. Validate employee eligibility
//     const [[employee]] = await connection.query(
//       `
//       SELECT id, first_name, last_name, joining_date, is_active, is_payroll_exempt, shift
//       FROM user WHERE id = ? AND is_active = 1 AND is_payroll_exempt = 0
//       `,
//       [employeeId]
//     );

//     if (!employee) {
//       throw new Error(
//         `Employee ${employeeId} is not eligible for payroll or does not exist`
//       );
//     }

//     // 2. Fetch employee salary structure
//     const [structure] = await connection.query(
//       `
//       SELECT pc.id, pc.name, pc.type, ess.* 
//       FROM employee_salary_structure ess 
//       JOIN payroll_components pc ON ess.component_id = pc.id 
//       WHERE ess.employee_id = ?
//       `,
//       [employeeId]
//     );

//     if (!structure.length) {
//       throw new Error(`No salary structure found for employee ${employeeId}`);
//     }

//     const structureMap = new Map(
//       structure.map((item) => [item.component_id, item])
//     );

//     // 3. Cache shift and attendance data (fetch once)
//     const shiftDetails = await getEmployeeShiftDetails(
//       connection,
//       employeeId,
//       cycle.start_date,
//       cycle.end_date
//     );

//     const attendanceData = await getDetailedAttendanceData(
//       connection,
//       employeeId,
//       cycle.start_date,
//       cycle.end_date
//     );

//     // 4. Calculate static components (full monthly amounts, not prorated)
//     // These are used as reference for formulas/percentages
//     const staticCalculatedComponents = new Map();

//     // Base salary - static version (full monthly)
//     const baseSalaryStructure = structureMap.get(1);
//     if (baseSalaryStructure) {
//       const monthlyBaseSalary = parseFloat(baseSalaryStructure.value) || 0;
//       staticCalculatedComponents.set(1, monthlyBaseSalary);
//     }

//     // Calculate other static components that might be used in formulas
//     const componentsForStatic = structure
//       .filter(s => s.calculation_type === 'Fixed')
//       .map(s => ({ id: s.component_id, name: s.name, type: s.type }));

//     for (const comp of componentsForStatic) {
//       const struct = structureMap.get(comp.id);
//       if (struct && struct.calculation_type === 'Fixed') {
//         staticCalculatedComponents.set(comp.id, parseFloat(struct.value) || 0);
//       }
//     }

//     console.log("Static calculated components:", Array.from(staticCalculatedComponents.entries()));

//     // 5. Now calculate actual prorated components
//     const calculatedComponents = new Map();

//     // Calculate base salary (prorated based on attendance)
//     if (componentIdsInRun.has(1)) {
//       const baseSalaryResult = await calculateBaseSalary(
//         connection,
//         employeeId,
//         cycle,
//         structureMap,
//         calculatedComponents,
//         shiftDetails,
//         attendanceData
//       );
//       if (baseSalaryResult) {
//         earnings.push({
//           component_id: 1,
//           component_name: "Base Salary",
//           amount: baseSalaryResult.amount,
//           calculation_breakdown: JSON.stringify(baseSalaryResult.breakdown),
//         });
//       }
//     }

//     // 6. Calculate overtime components (if included)
//     if (componentIdsInRun.has(5)) {
//       const overtimeResult = await calculateOvertimeComponent(
//         connection,
//         employeeId,
//         cycle,
//         "regular",
//         5,
//         staticCalculatedComponents,
//         structureMap,
//         { name: "Overtime (Regular)", type: "earning" }
//       );

//       if (overtimeResult && overtimeResult.amount > 0) {
//         calculatedComponents.set(5, overtimeResult.amount);
//         earnings.push({
//           component_id: 5,
//           component_name: "Overtime (Regular)",
//           amount: overtimeResult.amount,
//           calculation_breakdown: JSON.stringify(overtimeResult.breakdown),
//         });
//       }
//     }

//     if (componentIdsInRun.has(6)) {
//       const holidayOvertimeResult = await calculateOvertimeComponent(
//         connection,
//         employeeId,
//         cycle,
//         "holiday",
//         6,
//         staticCalculatedComponents,
//         structureMap,
//         { name: "Overtime (Holiday)", type: "earning" }
//       );

//       if (holidayOvertimeResult && holidayOvertimeResult.amount > 0) {
//         calculatedComponents.set(6, holidayOvertimeResult.amount);
//         earnings.push({
//           component_id: 6,
//           component_name: "Overtime (Holiday)",
//           amount: holidayOvertimeResult.amount,
//           calculation_breakdown: JSON.stringify(
//             holidayOvertimeResult.breakdown
//           ),
//         });
//       }
//     }

//     // 7. Calculate other structured components (with dependency resolution)
//     const otherComponents = componentsToProcess.filter(
//       c => ![1, 5, 6, 97, 98, 99].includes(c.id)
//     );

//     // Sort components by dependencies
//     let sortedComponentIds;
//     try {
//       sortedComponentIds = topologicalSortComponents(otherComponents, structureMap);
//     } catch (error) {
//       console.error("Error in topological sort:", error);
//       // Fallback to original order
//       sortedComponentIds = otherComponents.map(c => c.id);
//     }

//     // Process components in dependency order
//     for (const componentId of sortedComponentIds) {
//       const component = otherComponents.find(c => c.id === componentId);
//       if (!component) continue;

//       try {
//         const result = await calculateStructureComponent(
//           component,
//           structureMap,
//           staticCalculatedComponents,
//           employeeId,
//           cycle,
//           connection
//         );

//         if (result) {
//           calculatedComponents.set(component.id, result.amount);

//           const detail = {
//             component_id: component.id,
//             component_name: component.name,
//             amount: result.amount,
//             calculation_breakdown: JSON.stringify(result.breakdown),
//           };

//           if (component.type === "earning") {
//             earnings.push(detail);
//           } else {
//             deductions.push(detail);
//           }
//         }
//       } catch (error) {
//         console.error(`Error calculating component ${component.id} (${component.name}):`, error);
//         // Add error entry
//         const errorDetail = {
//           component_id: component.id,
//           component_name: component.name,
//           amount: 0,
//           calculation_breakdown: JSON.stringify({
//             source: "Calculation Error",
//             error: error.message,
//             component_id: component.id,
//           }),
//         };

//         if (component.type === "earning") {
//           earnings.push(errorDetail);
//         } else {
//           deductions.push(errorDetail);
//         }
//       }
//     }

//     // 8. Process Loan Deductions
//     if (componentIdsInRun.has(97)) {
//       console.log("Processing loan deductions");
//       const [dueLoans] = await connection.query(
//         `
//         SELECT 
//             las.id as schedule_id, 
//             las.emi_amount, 
//             las.principal_component,
//             las.interest_component,
//             las.due_date,
//             las.loan_application_id,
//             la.application_id_text,
//             lt.name as loan_type,
//             lt.interest_rate
//         FROM loan_amortization_schedule las
//         JOIN loan_applications la ON las.loan_application_id = la.id
//         JOIN loan_types lt ON la.loan_type_id = lt.id
//         WHERE la.employee_id = ? 
//         AND la.status = 'Disbursed'
//         AND las.status = 'Pending'
//         AND las.due_date <= ?
//         ORDER BY las.due_date
//         `,
//         [employeeId, cycle.end_date]
//       );

//       for (const loan of dueLoans) {
//         const breakdown = {
//           source: "Loan Management System",
//           deduction_type: "Loan EMI",
//           loan_details: {
//             application_id: loan.loan_application_id,
//             application_number: loan.application_id_text,
//             loan_type: loan.loan_type,
//             interest_rate: loan.interest_rate,
//             due_date: loan.due_date,
//           },
//           schedule_details: {
//             schedule_id: loan.schedule_id,
//             total_emi: loan.emi_amount,
//             principal_component: loan.principal_component,
//             interest_component: loan.interest_component,
//             breakdown_formula: `AED ${loan.principal_component} (Principal) + AED ${loan.interest_component} (Interest) = AED ${loan.emi_amount}`,
//           },
//           computed_value: loan.emi_amount,
//         };

//         deductions.push({
//           component_id: 97,
//           component_name: `Loan EMI - ${loan.loan_type}`,
//           amount: loan.emi_amount,
//           calculation_breakdown: JSON.stringify(breakdown),
//         });

//         processedItems.push({
//           item_type: "loan_emi",
//           item_id: loan.schedule_id,
//         });

//         // Update loan schedule status
//         await connection.query(
//           "UPDATE loan_amortization_schedule SET status = 'Paid' WHERE id = ?",
//           [loan.schedule_id]
//         );
//       }
//     }

//     // 9. Process HR Case Deductions (corrected sync flag logic)
// if (componentIdsInRun.has(98)) {
//   console.log("Processing HR case deductions");
//   const [hrCases] = await connection.query(
//     `
//     SELECT 
//         hc.id,
//         hc.case_id_text,
//         hc.title,
//         hc.deduction_amount,
//         hc.created_at,
//         cc.name as category_name,
//         u.first_name as raised_by_name
//     FROM hr_cases hc
//     JOIN case_categories cc ON hc.category_id = cc.id
//     JOIN user u ON hc.raised_by = u.id
//     WHERE hc.employee_id = ? 
//     AND hc.status = 'Approved' 
//     AND hc.is_deduction_synced = 1
//     `,
//     [employeeId]
//   );

//   for (const hrCase of hrCases) {
//     const breakdown = {
//       source: "HR Case Management System",
//       deduction_type: "HR Case Deduction",
//       case_details: {
//         case_id: hrCase.id,
//         case_number: hrCase.case_id_text,
//         case_title: hrCase.title,
//         category: hrCase.category_name,
//         raised_by: hrCase.raised_by_name,
//         case_date: hrCase.created_at,
//       },
//       deduction_details: {
//         approved_amount: hrCase.deduction_amount,
//         deduction_reason: `HR Case: ${hrCase.title}`,
//       },
//       computed_value: hrCase.deduction_amount,
//     };

//     deductions.push({
//       component_id: 98,
//       component_name: `HR Case: ${hrCase.title}`,
//       amount: hrCase.deduction_amount,
//       calculation_breakdown: JSON.stringify(breakdown),
//     });

//     processedItems.push({
//       item_type: "hr_case",
//       item_id: hrCase.id,
//     });

//     // Mark as Closed after deduction is processed in payroll
//     await connection.query(
//       "UPDATE hr_cases SET status = 'Closed' WHERE id = ?",
//       [hrCase.id]
//     );
    
//     console.log(`Marked HR case ${hrCase.id} as Closed after payroll deduction`);
//   }
// }


//     // 10. Process Expense Reimbursements (fixed status update)
//     if (componentIdsInRun.has(99)) {
//       console.log("Processing expense reimbursements");
//       const [expenses] = await connection.query(
//         `
//         SELECT 
//             ec.id, 
//             ec.title, 
//             ec.amount, 
//             ec.expense_date, 
//             ec.approval_date,
//             exc.name AS category_name,
//             u.first_name AS approved_by_name
//         FROM expense_claims ec
//         JOIN expense_categories exc ON ec.category_id = exc.id
//         LEFT JOIN user u ON u.id = ec.approved_by
//         WHERE ec.employee_id = ? 
//         AND ec.status = 'Processed'
//         AND ec.reimbursement_method = 'Payroll'
//         AND ec.reimbursed_in_payroll_id IS NULL
//         ORDER BY ec.approval_date DESC
//         `,
//         [employeeId]
//       );

//       console.log(`Expenses fetched for employee ${employeeId}:`, expenses);

//       for (const expense of expenses) {
//         try {
//           const breakdown = {
//             source: "Expense Management System",
//             reimbursement_type: "Expense Reimbursement",
//             expense_details: {
//               expense_id: expense.id,
//               expense_title: expense.title,
//               category: expense.category_name,
//               expense_date: expense.expense_date,
//               approval_date: expense.approval_date,
//               approved_by: expense.approved_by_name,
//             },
//             reimbursement_details: {
//               approved_amount: expense.amount,
//               reimbursement_method: "Payroll",
//             },
//             computed_value: expense.amount,
//           };

//           earnings.push({
//             component_id: 99,
//             component_name: `Reimbursement: ${expense.title}`,
//             amount: expense.amount,
//             calculation_breakdown: JSON.stringify(breakdown),
//           });

//           console.log(
//             `Added expense id ${expense.id} to earnings with amount ${expense.amount}`
//           );

//           processedItems.push({
//             item_type: "expense_claim",
//             item_id: expense.id,
//           });

//           // Update expense status to Reimbursed and set payroll ID
//           await connection.query(
//             "UPDATE expense_claims SET reimbursed_in_payroll_id = ?, status = 'Reimbursed' WHERE id = ?",
//             [cycle.id, expense.id]
//           );
          
//           console.log(
//             `Marked expense id ${expense.id} as Reimbursed in payroll ${cycle.id}`
//           );
//         } catch (err) {
//           console.error(`Error processing expense id ${expense.id}:`, err);
//         }
//       }

//       console.log(`Total earnings after expenses: ${earnings.length}`);
//     }

//     return { earnings, deductions, processedItems };
//   } catch (error) {
//     console.error(
//       `Payroll calculation error for employee ${employeeId}:`,
//       error
//     );
//     throw error;
//   }
// };





const { DateTime } = require("luxon");
const { evaluate } = require("mathjs");

function toIdNameMap(rows) {
  return rows.reduce((map, row) => {
    map[row.id] = row.name;
    return map;
  }, {});
}

/**
 * @description Evaluate formula string or JSON array safely with component substitutions
 */
function evaluateFormula(payrollMap,formulaJson, calculatedComponents, detailedBreakdown = {}) {
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

    console.log(`Evaluating formula expression: ${expression}`);

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

function calculateDaysInPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

// Calculate base salary prorated for attendance
async function calculateBaseSalary(connection, employeeId, cycle, structureMap, calculatedComponents, shiftDetails, attendanceData) {
  try {
    const baseSalaryStructure = structureMap.get(1);
    if (!baseSalaryStructure) {
      throw new Error(`Base salary structure not found for employee ${employeeId}`);
    }

    const monthlyBaseSalary = parseFloat(baseSalaryStructure.value) || 0;
    if (monthlyBaseSalary === 0) {
      throw new Error(`Invalid base salary amount for employee ${employeeId}`);
    }

    const daysInPeriod = calculateDaysInPeriod(cycle.start_date, cycle.end_date);
    const dailyRate = monthlyBaseSalary / daysInPeriod;
    const hourlyRate = dailyRate / shiftDetails.scheduled_hours;

    const actualBaseSalary = hourlyRate * attendanceData.total_regular_hours;

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
        total_days_in_period: daysInPeriod,
      },
      rate_calculations: {
        daily_rate: dailyRate,
        daily_rate_formula: `AED ${monthlyBaseSalary} ÷ ${daysInPeriod} days = AED ${dailyRate.toFixed(2)}`,
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
        half_days: attendanceData.half_days,
      },
      final_calculation: {
        formula: `AED ${hourlyRate.toFixed(2)} × ${attendanceData.total_regular_hours} hours`,
        regular_hours_worked: attendanceData.total_regular_hours,
        computed_amount: actualBaseSalary,
      },
    };

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

// Calculate overtime component with support for various calculation types
// async function calculateOvertimeComponent(connection, employeeId, cycle, overtimeType, componentId, staticCalculatedComponents, structureMap, componentDetails) {
//   try {
//     const [overtimeRecords] = await connection.query(
//       `
//       SELECT 
//           eor.id,
//           eor.request_date,
//           COALESCE(eor.overtime_hours, 0) as overtime_hours,
//           COALESCE(eor.approved_hours, eor.overtime_hours, 0) as approved_hours,
//           eor.overtime_type,
//           eor.overtime_start,
//           eor.overtime_end,
//           ar.attendance_date,
//           s.name as shift_name,
//           COALESCE(s.scheduled_hours, 8) as scheduled_hours
//       FROM employee_overtime_records eor
//       JOIN attendance_record ar ON eor.attendance_record_id = ar.id
//       JOIN shifts s ON ar.shift = s.id
//       WHERE eor.employee_id = ? 
//       AND eor.status = 'approved' 
//       AND eor.overtime_type = ? 
//       AND eor.request_date BETWEEN ? AND ?
//       ORDER BY eor.request_date
//       `,
//       [employeeId, overtimeType, cycle.start_date, cycle.end_date]
//     );

//     if (!overtimeRecords.length) {
//       return null;
//     }

//     const totalApprovedHours = overtimeRecords.reduce((sum, record) => sum + (parseFloat(record.approved_hours) || 0), 0);
//     if (totalApprovedHours === 0) return null;

//     const overtimeStructure = structureMap.get(componentId);
//     if (!overtimeStructure) throw new Error(`Overtime component structure not found for component ${componentId}`);

//     let overtimeRatePerHour = 0;
//     let breakdown = {};

//     switch (overtimeStructure.calculation_type) {
//       case "Fixed":
//         overtimeRatePerHour = parseFloat(overtimeStructure.value) || 0;
//         breakdown = {
//           source: "Employee Salary Structure",
//           calculation_type: "Fixed Rate Per Hour",
//           overtime_details: {
//             type: overtimeType,
//             component_id: componentId,
//             component_name: componentDetails.name,
//             total_approved_hours: totalApprovedHours,
//             fixed_rate_per_hour: overtimeRatePerHour,
//           },
//           final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
//           overtime_records: overtimeRecords.map((record) => ({
//             date: record.request_date,
//             approved_hours: record.approved_hours,
//             shift_name: record.shift_name,
//           })),
//         };
//         break;
//       case "Percentage":
//         const baseComponentId = overtimeStructure.based_on_component_id;
//         const baseValue = staticCalculatedComponents.get(baseComponentId) || 0;
//         const percentage = parseFloat(overtimeStructure.value);
//         const [[baseComponent]] = await connection.query("SELECT name, type FROM payroll_components WHERE id = ?", [baseComponentId]);
//         overtimeRatePerHour = (baseValue * percentage) / 100;
//         breakdown = {
//           source: "Employee Salary Structure",
//           calculation_type: "Percentage Based Rate",
//           overtime_details: {
//             type: overtimeType,
//             component_id: componentId,
//             component_name: componentDetails.name,
//             total_approved_hours: totalApprovedHours,
//           },
//           base_component: {
//             id: baseComponentId,
//             name: baseComponent?.name || `Component ${baseComponentId}`,
//             value: baseValue,
//           },
//           percentage_calculation: {
//             percentage: percentage,
//             formula: `(AED ${baseValue.toFixed(2)} × ${percentage}%) ÷ 100 = AED ${overtimeRatePerHour.toFixed(2)} per hour`,
//           },
//           final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
//           overtime_records: overtimeRecords.map((record) => ({
//             date: record.request_date,
//             approved_hours: record.approved_hours,
//             shift_name: record.shift_name,
//           })),
//         };
//         break;
//       case "Formula":
//         const [pc] = await connection.query(`select id, name from payroll_components`);
//         const payrollMap = toIdNameMap(pc);
//         const formulaResult = evaluateFormula(payrollMap,overtimeStructure.custom_formula, staticCalculatedComponents, {
//           overtime_component_id: componentId,
//           overtime_type: overtimeType,
//           calculation_context: "Overtime Rate Per Hour",
//         });
//         overtimeRatePerHour = formulaResult.value || 0;
//         breakdown = {
//           ...formulaResult.breakdown,
//           source: "Employee Salary Structure",
//           calculation_type: "Custom Formula",
//           overtime_details: {
//             type: overtimeType,
//             component_id: componentId,
//             component_name: componentDetails.name,
//             total_approved_hours: totalApprovedHours,
//             per_hour_rate: overtimeRatePerHour,
//           },
//           final_calculation: `AED ${overtimeRatePerHour.toFixed(2)} × ${totalApprovedHours} hours = AED ${(overtimeRatePerHour * totalApprovedHours).toFixed(2)}`,
//           overtime_records: overtimeRecords.map((record) => ({
//             date: record.request_date,
//             approved_hours: record.approved_hours,
//             shift_name: record.shift_name,
//           })),
//         };
//         break;
//       default:
//         throw new Error(`Unknown calculation type: ${overtimeStructure.calculation_type} for overtime component ${componentId}`);
//     }

//     const overtimeAmount = overtimeRatePerHour * totalApprovedHours;
//     return { amount: overtimeAmount, breakdown };
//   } catch (error) {
//     console.error(`Error calculating ${overtimeType} overtime for employee ${employeeId}:`, error);
//     return {
//       amount: 0,
//       breakdown: {
//         source: "Overtime Calculation Error",
//         error: error.message,
//         overtime_type: overtimeType,
//         component_id: componentId,
//       },
//     };
//   }
// }


async function calculateOvertimeComponent(
  connection,
  employeeId,
  cycle,
  overtimeType,
  componentId,
  staticCalculatedComponents, // Map currently with fixed static values only
  structureMap,
  componentDetails
) {
  try {
    // Query approved overtime records
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

    // Helper: recursively calculate static component values for all referenced components
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
          // Parse formula JSON
          const formulaArr =
            typeof struct.custom_formula === "string"
              ? JSON.parse(struct.custom_formula)
              : struct.custom_formula;

          // Recursively prepare map of dependent static values
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

          // Build payroll component name map for formula evaluation
          const [payrollComps] = await connection.query(
            `SELECT id, name FROM payroll_components`
          );
          const payrollMap = payrollComps.reduce((map, c) => {
            map[c.id] = c.name;
            return map;
          }, {});

          // Evaluate formula using static dependency values
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
            formula: `(AED ${baseValue.toFixed(2)} × ${percentage}%) ÷ 100 = AED ${overtimeRatePerHour.toFixed(2)} per hour`,
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
        // Parse the formula JSON
        const formulaArray =
          typeof overtimeStructure.custom_formula === "string"
            ? JSON.parse(overtimeStructure.custom_formula)
            : overtimeStructure.custom_formula;

        // Calculate static dependencies recursively for all referenced components
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

        // Build payroll component name map for formula evaluation
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


// Calculate other structure components prorated by attendance where appropriate
async function calculateStructureComponent(component, structureMap, calculatedComponents, employeeId, cycle, connection) {
  const structureRule = structureMap.get(component.id);
  if (!structureRule) {
    throw new Error(`Salary structure not found for component ${component.id} (${component.name})`);
  }

  let value = 0;
  let breakdown = {};
  const daysInPeriod = calculateDaysInPeriod(cycle.start_date, cycle.end_date);

  switch (structureRule.calculation_type) {
    case "Fixed":
      // Prorate fixed amount by attendance days
      // Assume prorated based on days worked vs period days
      const fixedAmount = parseFloat(structureRule.value) || 0;
      // Get attendance days from base salary attendance
      const baseAttendanceHours = calculatedComponents.get(1) / (structureRule.value || 1) * daysInPeriod || daysInPeriod; // Fallback to full if unable
      // For simplicity, use attendance days as days worked (approximate)
      const baseSalary = calculatedComponents.get(1) || 0;
      const proratedAmount = (fixedAmount / daysInPeriod) * (baseAttendanceHours / (baseSalary ? baseSalary / daysInPeriod : daysInPeriod));
      value = proratedAmount;
      breakdown = {
        source: "Employee Salary Structure",
        calculation_type: "Fixed Amount Prorated",
        component_details: { id: component.id, name: component.name, type: component.type },
        structure_rule: { calculation_type: "Fixed", configured_amount: structureRule.value },
        prorated_for_attendance: true,
        prorated_amount: value,
        total_days_in_period: daysInPeriod,
      };
      break;

    case "Percentage":
      const baseComponentId = structureRule.based_on_component_id;
      const baseValue = calculatedComponents.get(baseComponentId);
      const [[baseComponent]] = await connection.query("SELECT name, type FROM payroll_components WHERE id = ?", [baseComponentId]);
      if (baseValue === null || baseValue === undefined) {
        throw new Error(`Base component ${baseComponentId} for percentage not computed yet`);
      }
      const percentage = parseFloat(structureRule.value);
      value = (baseValue * percentage) / 100;
      breakdown = {
        source: "Employee Salary Structure",
        calculation_type: "Percentage Based",
        component_details: { id: component.id, name: component.name, type: component.type },
        structure_rule: {
          calculation_type: "Percentage",
          percentage,
          based_on_component: { id: baseComponentId, name: baseComponent.name, current_value: baseValue }
        },
        calculated_value: value,
      };
      break;

    case "Formula":
      const result = evaluateFormula(structureRule.custom_formula, calculatedComponents, {
        component_details: { id: component.id, name: component.name, type: component.type },
        employee_context: { employee_id: employeeId, cycle_start: cycle.start_date, cycle_end: cycle.end_date }
      });
      value = result.value;
      breakdown = {
        ...result.breakdown,
        source: "Employee Salary Structure",
        calculation_type: "Custom Formula"
      };
      break;

    default:
      throw new Error(`Unknown calculation type: ${structureRule.calculation_type} for component ${component.id}`);
  }

  return { component, amount: value, breakdown };
}

// Topological sort with dependency detection (same as before)
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

  console.log("Components to process:", Array.from(componentIdsInRun));

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

    // staticCalculatedComponents holds full monthly (static) component values
    // calculatedComponents holds actual prorated values using attendance
    const staticCalculatedComponents = new Map();
    const calculatedComponents = new Map();

    // Base salary full monthly value for static reference
    const baseSalaryStructure = structureMap.get(1);
    if (baseSalaryStructure) staticCalculatedComponents.set(1, parseFloat(baseSalaryStructure.value) || 0);

    // Add all fixed-type components to staticCalculatedComponents for reference
    structure.filter(s => s.calculation_type === 'Fixed').forEach(struct => {
      staticCalculatedComponents.set(struct.component_id, parseFloat(struct.value) || 0);
    });

    console.log("Static components for formula reference:", Array.from(staticCalculatedComponents.entries()));

    // Calculate prorated base salary for real use
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

    // Calculate overtime (based on static values, not prorated)
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

    // Calculate other components prorated to base or attendance
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
        const result = await calculateStructureComponent(comp, structureMap, calculatedComponents, employeeId, cycle, connection);
        if (result) {
          calculatedComponents.set(comp.id, result.amount);
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

    // Loans, cases and expenses handling (unchanged, refer to previous answer)
        // 8. Process Loan Deductions
    if (componentIdsInRun.has(97)) {
      console.log("Processing loan deductions");
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
      
      console.log(dueLoans)

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

        // Update loan schedule status
        // await connection.query(
        //   "UPDATE loan_amortization_schedule SET status = 'Paid' WHERE id = ?",
        //   [loan.schedule_id]
        // );
      }
    }

    // 9. Process HR Case Deductions (corrected sync flag logic)
if (componentIdsInRun.has(98)) {
  console.log("Processing HR case deductions");
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

  console.log(hrCases)

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

    // Mark as Closed after deduction is processed in payroll
    // await connection.query(
    //   "UPDATE hr_cases SET status = 'Closed' WHERE id = ?",
    //   [hrCase.id]
    // );
    
    console.log(`Marked HR case ${hrCase.id} as Closed after payroll deduction`);
  }
}


    // 10. Process Expense Reimbursements (fixed status update)
    if (componentIdsInRun.has(99)) {
      console.log("Processing expense reimbursements");
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

      console.log(expenses)

      console.log(`Expenses fetched for employee ${employeeId}:`, expenses);

      for (const expense of expenses) {
        try {
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

          console.log(
            `Added expense id ${expense.id} to earnings with amount ${expense.amount}`
          );

          processedItems.push({
            item_type: "expense_claim",
            item_id: expense.id,
          });

          // Update expense status to Reimbursed and set payroll ID
          // await connection.query(
          //   "UPDATE expense_claims SET reimbursed_in_payroll_id = ?, status = 'Reimbursed' WHERE id = ?",
          //   [cycle.id, expense.id]
          // );
          
          console.log(
            `Marked expense id ${expense.id} as Reimbursed in payroll ${cycle.id}`
          );
        } catch (err) {
          console.error(`Error processing expense id ${expense.id}:`, err);
        }
      }

      console.log(`Total earnings after expenses: ${earnings.length}`);
    }

    return { earnings, deductions, processedItems };
  } catch (err) {
    console.error(`Payroll calculation error for employee ${employeeId}:`, err);
    throw err;
  }
};


