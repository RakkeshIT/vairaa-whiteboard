import mongoose from "mongoose";

const whiteboardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "My Whiteboard",
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    doc: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: () => ({
        pages: [
          {
            id: "page-1",
            name: "Page 1",
            elements: [],
          },
        ],
        current: "page-1",
        bg: "grid",
        dark: false,
        snap: false,
      }),
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

whiteboardSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj.__v;
  return obj;
};

export const Whiteboard = mongoose.model("Whiteboard", whiteboardSchema);

