const verifyRole = role => {
  return async (req, res, next) => {
    const email = req.email;
    //   get user from db and check role === user.role /// 'admin' === user.role
    next();
  };
};

module.exports = verifyRole;
