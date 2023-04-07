const Sequelize = require("sequelize");
const sequelize = require("../config/database");
const User = require("../user/User");

const Model = Sequelize.Model;

class Token extends Model {}

Token.init(
  {
    token: {
      type: Sequelize.STRING,
    },
    lastUsedAt: {
      type: Sequelize.DATE,
    },
  },
  {
    sequelize,
    modelName: "token",
    timestamps: false,
  }
);

module.exports = Token;
