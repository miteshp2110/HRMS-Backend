/**
 * @description Middleware factory for role-based authorization.
 * It checks if the authenticated user has ALL of the required permissions.
 * @param {string[]} requiredPermissions - An array of permission names required to access the route.
 */
const authorize = (requiredPermissions = []) => {
  
  return (req, res, next) => {
    // This middleware must run AFTER the authenticate middleware
    const user = req.user;
    if (!user || !user.permissions) {
      return res.status(403).json({ message: 'Forbidden. No user permissions found.' });
    }
    // console.log(user.permissions)

    // Check if the user has all of the required permissions
    const hasAllPermissions = requiredPermissions.every(p => user.permissions.includes(p));

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        message: 'Forbidden. You do not have the necessary permissions to perform this action.',
        required: requiredPermissions,
        yours: user.permissions
      });
    }

    next(); // User is authorized, proceed
  };
};

module.exports = authorize;