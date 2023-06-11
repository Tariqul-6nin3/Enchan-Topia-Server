const verifyJwt = async (req, res, next) => {
  req.email = "jwt theke pawa result";
  next();
};

module.exports = { verifyJwt };
