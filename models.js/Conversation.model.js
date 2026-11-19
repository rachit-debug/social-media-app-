
import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Conversation = sequelize.define(
  "Conversation",
  {
    userOneId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    userTwoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["userOneId", "userTwoId"],
      },
    ],
  }
);
