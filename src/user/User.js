const Sequelize = require("sequelize");
const sequelize = require("../config/database");
const Token = require("../auth/Token");

const Model = Sequelize.Model;

class User extends Model {}

User.init(
  {
    username: {
      type: Sequelize.STRING,
    },
    email: {
      type: Sequelize.STRING,
    },
    password: {
      type: Sequelize.STRING,
    },
    inactive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    activationToken: {
      type: Sequelize.STRING,
    },
  },
  {
    sequelize,
    modelName: "user",
  }
);

User.hasMany(Token, { onDelete: "cascade", foreignKey: "userId" });
// Token.belongsTo(User, { foreignKey: "userId" });

module.exports = User;
