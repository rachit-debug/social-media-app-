import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Post = sequelize.define("Post",{
  caption:{
    type : DataTypes.TEXT,
    allowNull: true,
  },
  image : {
    type : DataTypes.STRING,
    allowNull : true
  },
  userId : {
    type : DataTypes.INTEGER,
    allowNull : false
  },
  imagePublicId: {
  type: DataTypes.STRING,
  allowNull: true,
  }

}, {
    timestamps: true,
  })
