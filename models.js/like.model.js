
import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

export const Like = sequelize.define(
  "Like",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["userId", "postId"],
      },
    ],
  }
);
