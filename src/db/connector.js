const mysql = require('mysql2/promise');
const secrets = require('../config/secrets');

// Create the pool as before
const pool = mysql.createPool({
  host: secrets.dbHost,
  user: secrets.dbUser,
  password: secrets.dbPassword,
  database: secrets.dbDatabase,
  port: secrets.dbPort,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * @description A function to verify the database connection.
 * It gets a connection and immediately releases it.
 */
const checkConnection = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    // If we get here, the connection is successful
    return true; 
  } catch (error) {
    // If we get here, we failed to connect
    console.error('❌ Could not connect to the database:', error.message);
    return false;
  } finally {
    // Always release the connection
    if (connection) connection.release();
  }
};

// Export both the pool for queries and the check function for startup
module.exports = { pool, checkConnection };