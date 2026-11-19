import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";


export const Message = sequelize.define("Message",{
  ConversationId : {
    type : DataTypes.INTEGER,
    allowNull : false
  },
  senderId : {
    type : DataTypes.INTEGER,
    allowNull : false
  },
  context : {
    type : DataTypes.TEXT,
    allowNull : false
  },
  image : {
    type : DataTypes.STRING,
    allowNull : false
  },
  isRead : {
    type : DataTypes.BOOLEAN,
    defaultValue : false
  }
},{
  timestamps : true
})
