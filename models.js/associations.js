import { User } from "./User.model.js";
import { Post } from "./Post.model.js";
import { Like } from "./Like.model.js";
import { Comment } from "./comment.model.js";
import { Message } from "../models.js/Message.model.js";
import { Conversation } from "./Conversation.model.js";
import { Follow } from "./Follow.model.js";

User.hasMany(Like, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});

Like.belongsTo(User, {
  foreignKey: "userId",
});

Post.hasMany(Like, {
  foreignKey: "postId",
  onDelete: "CASCADE",
});

Like.belongsTo(Post, {
  foreignKey: "postId",
});

User.hasMany(Comment,{
  foreignKey : "userId",
  as : "comments"
})

Comment.belongsTo(User,{
  foreignKey : "userId",
  as : "user",
})

Post.hasMany(Comment,{
  foreignKey : "postId",
  as : "post"
})

Comment.belongsTo(Post,{
  foreignKey : "postId",
  as : "post"
})

Comment.hasMany(Comment, {
  foreignKey: "parentId",
  as: "replies",
});

Comment.belongsTo(Comment, {
  foreignKey: "parentId",
  as: "parent",
});

User.hasMany(Follow, {
  foreignKey: "followerId",
  as: "following",
});

Follow.belongsTo(User, {
  foreignKey: "followerId",
  as: "follower",
});

Conversation.hasMany(Message, {
  foreignKey: "conversationId",
  as: "messages",
  onDelete: "CASCADE",
});

Message.belongsTo(Conversation, {
  foreignKey: "conversationId",
  as: "conversation",
});
