import express from "express";
import { Whiteboard } from "../models/Whiteboard.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Apply auth middleware to all whiteboard routes
router.use(requireAuth);

/**
 * @route   GET /api/whiteboard
 * @desc    Get the current authenticated user's active personal whiteboard
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find the latest updated whiteboard belonging to this user
    let board = await Whiteboard.findOne({ userId }).sort({ updatedAt: -1 });

    // If no board exists for this user, create an initial default one
    if (!board) {
      board = await Whiteboard.create({
        userId,
        title: `${req.user.name}'s Whiteboard`,
        isDefault: true,
        doc: {
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
        },
      });
    }

    return res.status(200).json({
      success: true,
      whiteboard: {
        id: board._id,
        title: board.title,
        doc: board.doc,
        updatedAt: board.updatedAt,
        createdAt: board.createdAt,
      },
    });
  } catch (error) {
    console.error("[Whiteboard Error] Failed to fetch board:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load user's whiteboard.",
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/whiteboard
 * @desc    Save/Sync current user's personal whiteboard
 */
router.put("/", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { doc, title, whiteboardId } = req.body;

    if (!doc || typeof doc !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid whiteboard document payload.",
      });
    }

    // Query strictly matching user's ID to enforce isolation
    let query = { userId };
    if (whiteboardId) {
      query._id = whiteboardId;
    }

    let board = await Whiteboard.findOne(query).sort({ updatedAt: -1 });

    if (board) {
      board.doc = doc;
      if (title && typeof title === "string") {
        board.title = title.trim();
      }
      board.updatedAt = new Date();
      await board.save();
    } else {
      // Create new if not found
      board = await Whiteboard.create({
        userId,
        title: title || `${req.user.name}'s Whiteboard`,
        doc,
        isDefault: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Whiteboard saved successfully to cloud.",
      whiteboard: {
        id: board._id,
        title: board.title,
        updatedAt: board.updatedAt,
      },
    });
  } catch (error) {
    console.error("[Whiteboard Error] Failed to save board:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save whiteboard to cloud.",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/whiteboard/list
 * @desc    List all whiteboards owned by the authenticated user
 */
router.get("/list", async (req, res) => {
  try {
    const userId = req.user.userId;
    const boards = await Whiteboard.find({ userId })
      .select("title isDefault updatedAt createdAt doc.pages")
      .sort({ updatedAt: -1 });

    const summary = boards.map((b) => ({
      id: b._id,
      title: b.title,
      isDefault: b.isDefault,
      pageCount: Array.isArray(b.doc?.pages) ? b.doc.pages.length : 1,
      updatedAt: b.updatedAt,
      createdAt: b.createdAt,
    }));

    return res.status(200).json({
      success: true,
      whiteboards: summary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to list user whiteboards.",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/whiteboard/new
 * @desc    Create a new separate whiteboard for this user
 */
router.post("/new", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title } = req.body;

    const board = await Whiteboard.create({
      userId,
      title: title?.trim() || `New Board ${new Date().toLocaleDateString()}`,
      isDefault: false,
      doc: {
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
      },
    });

    return res.status(201).json({
      success: true,
      message: "New whiteboard created.",
      whiteboard: {
        id: board._id,
        title: board.title,
        doc: board.doc,
        updatedAt: board.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create new whiteboard.",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/whiteboard/:id
 * @desc    Get a specific whiteboard by ID (enforces user ownership)
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.user.userId;
    const board = await Whiteboard.findOne({ _id: req.params.id, userId });

    if (!board) {
      return res.status(404).json({
        success: false,
        message: "Whiteboard not found or unauthorized.",
      });
    }

    return res.status(200).json({
      success: true,
      whiteboard: {
        id: board._id,
        title: board.title,
        doc: board.doc,
        updatedAt: board.updatedAt,
        createdAt: board.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve whiteboard.",
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/whiteboard/:id
 * @desc    Delete a specific whiteboard (enforces user ownership)
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user.userId;
    const deleted = await Whiteboard.findOneAndDelete({
      _id: req.params.id,
      userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Whiteboard not found or unauthorized.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Whiteboard deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete whiteboard.",
      error: error.message,
    });
  }
});

export default router;

