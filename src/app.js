const express = require('express')
const app = express()
const cors = require('cors')

const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/user/userRoutes')
const roleRoutes = require('./routes/roles/roleRoutes')
const bankRoutes = require('./routes/bank/bankRoutes')
const jobRoutes = require('./routes/job/jobRoutes')

const { getAllPermissions } = require('./controllers/roles')
const authenticate = require('./middleware/authenticate')
const authorize = require('./middleware/authorize')

// set JSON limit here
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))



app.use('/api/auth',authRoutes)

// User Routes

app.use('/api/user',userRoutes)


// Roles Routes

app.use("/api/roles",roleRoutes)
app.use("/api/permissions",authenticate,authorize(['roles.manage']),getAllPermissions)

// Job Routes

app.use("/api/jobs",jobRoutes)

// Shift Routes

app.use("/api/shifts",require('./routes/shifts/shiftRoutes'))

// Documents Routes

app.use("/api/documents",require('./routes/documents/documentRoutes'))

// Skills Routes

app.use("/api/skills",require('./routes/skills/skillsRoutes'))

// Leave Routes

app.use("/api/leaves",require('./routes/leaves/leaveRoutes'))

// Expense Routes

app.use("/api/expense",require('./routes/expense/expenseRoutes'))

// Bank Routes

app.use("/api/bank",bankRoutes)

// Skill Matrix

app.use("/api/skillMatrix",require('./routes/skillMatrix/skillMatrixRoutes'))

// Attendance

app.use('/api/attendance',require('./routes/attendance/attendanceRoute'))

// Calender

app.use('/api/calender',require('./routes/holidays/holidayRoutes'))


// Payroll

app.use('/api/payroll/components',require('./routes/payrollComponents/payrollComponentsRoutes'))

app.use('/api/payroll/structure',require('./routes/salaryStructure/salaryStuctureRoutes'))

// Loans

app.use('/api/loans',require('./routes/loan/loanRoutes'))

// Payroll

app.use('/api/payroll',require('./routes/payroll/payrollRoutes'))

// Summary

app.use('/api/summary',require('./routes/summary/summaryRoutes'))

//Dashboard

app.use('/api/dashboard',require('./routes/dashboard/dashboardRoutes'))


//Reports

app.use('/api/reports',require('./routes/reports/reportRoutes'))

app.use("/api/settings/name-series",require('./routes/nameSeriesRoutes'))



app.use("/api/benefits", require('./routes/benefits/benefitRoutes'));


app.use("/api/eos", require('./routes/eos/eosRoutes'));

app.use("/api/cases", require('./routes/cases/caseRoutes'));

app.use("/api/onboarding", require('./routes/onboarding/onboardingRoutes.js'));

app.use("/api/performance", require('./routes/performance/performanceRoutes.js'));


module.exports = app