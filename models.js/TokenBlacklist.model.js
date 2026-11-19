import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const TokenBlacklist = sequelize.define("TokenBlacklist",{
  tokenHash : {
    type : DataTypes.STRING(64),
    allowNull : false,
    unique : true
  },
   expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
},{timestamps : true})
