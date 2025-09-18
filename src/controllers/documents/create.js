// const { pool } = require('../../db/connector');

// /**
//  * @description Create a new required document type.
//  */
// const createDocument = async (req, res) => {
//   const { name } = req.body;

//   if (!name) {
//     return res.status(400).json({ message: 'Name is required.' });
//   }

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     const [result] = await connection.query(
//       'INSERT INTO required_documents (name) VALUES (?)',
//       [name]
//     );
//     res.status(201).json({
//       success: true,
//       message: 'Required document created successfully.',
//       document: { id: result.insertId, name },
//     });
//   } catch (error) {
//     // Handle potential duplicate entry error
//     if (error.code === 'ER_DUP_ENTRY') {
//       return res.status(409).json({ message: 'A document with this name already exists.' });
//     }
//     console.error('Error creating document:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { createDocument };

const { pool } = require('../../db/connector');

/**
 * @description Create a new required document type.
 */
const createDocument = async (req, res) => {
  const { name, reminder_threshold } = req.body;
  const updated_by = req.user.id; // Get the ID of the user creating the document

  if (!name) {
    return res.status(400).json({ message: 'Name is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO required_documents (name, reminder_threshold, updated_by) VALUES (?, ?, ?)',
      [name, reminder_threshold, updated_by]
    );
    res.status(201).json({
      success: true,
      message: 'Required document created successfully.',
      document: { id: result.insertId, name, reminder_threshold },
    });
  } catch (error) {
    // Handle potential duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A document with this name already exists.' });
    }
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createDocument };