// delayMiddleware.js
const artificialDelay = (options = {}) => {
  const {
    min = 100,   // minimum delay in ms
    max = 800,   // maximum delay in ms
    enabled = process.env.NODE_ENV !== "production" // disable in prod by default
  } = options;

  return (req, res, next) => {
    if (!enabled) return next();

    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(next, delay);
  };
};


module.exports = {artificialDelay}