import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ১. লগইন করা ইউজার: নিজের প্রোফাইল আপডেট (রোল বা প্ল্যান পরিবর্তন নিষিদ্ধ)
router.patch("/users/profile", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = getCollections();
    const { name, image, businessName } = req.body;
    const updateFields = {};

    if (name) updateFields.name = name;
    if (image) updateFields.image = image;
    if (businessName !== undefined && req.user.role === "Vendor") {
      updateFields.businessName = businessName;
    }

    await usersCollection.updateOne(
      { _id: req.user._id },
      { $set: updateFields },
    );
    res
      .status(200)
      .json({ success: true, message: "Profile updated successfully!" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update profile." });
  }
});

// ২. অ্যাডমিন: সব ইউজার দেখা (Search & Role Filter)
router.get(
  "/admin/users",
  verifyToken,
  verifyRole("Admin"),
  async (req, res) => {
    try {
      const { usersCollection } = getCollections();
      const { search, role } = req.query;
      const query = {};

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }
      if (role && role !== "All") query.role = role;

      const users = await usersCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch users." });
    }
  },
);

// ৩. অ্যাডমিন: ইউজার Block বা Unblock করা
router.patch(
  "/admin/users/:id/block",
  verifyToken,
  verifyRole("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isBlocked } = req.body;
      if (!ObjectId.isValid(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid User ID." });
      if (id === req.user._id.toString()) {
        return res
          .status(400)
          .json({ success: false, message: "You cannot block yourself." });
      }

      const { usersCollection } = getCollections();
      await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked: Boolean(isBlocked) } },
      );
      res.status(200).json({
        success: true,
        message: `User has been ${isBlocked ? "blocked" : "unblocked"} successfully!`,
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to update user status." });
    }
  },
);

// ৪. অ্যাডমিন: সব সার্ভিস দেখা (Pending, Approved, Rejected)
router.get(
  "/admin/services",
  verifyToken,
  verifyRole("Admin"),
  async (req, res) => {
    try {
      const { servicesCollection } = getCollections();
      const { search, status } = req.query;
      const query = {};
      if (search) query.serviceName = { $regex: search, $options: "i" };
      if (status && status !== "All") query.status = status;

      const services = await servicesCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.status(200).json({ success: true, data: services });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch all services." });
    }
  },
);

// ৫. অ্যাডমিন: সার্ভিস Approve বা Reject করা
router.patch(
  "/admin/services/:id/status",
  verifyToken,
  verifyRole("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (
        !ObjectId.isValid(id) ||
        !["Approved", "Rejected", "Pending"].includes(status)
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid ID or status." });
      }

      const { servicesCollection } = getCollections();
      await servicesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } },
      );
      res
        .status(200)
        .json({
          success: true,
          message: `Service status updated to ${status}!`,
        });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to update service status." });
    }
  },
);

// ৬. ড্যাশবোর্ড স্ট্যাটাসটিক্স (Customer, Vendor, Admin Overview)
router.get("/dashboard/stats", verifyToken, async (req, res) => {
  try {
    const {
      usersCollection,
      servicesCollection,
      bookingsCollection,
      transactionsCollection,
    } = getCollections();
    const role = req.user.role || "Customer";
    const userId = req.user._id.toString();

    if (role === "Admin") {
      const totalUsers = await usersCollection.countDocuments();
      const totalVendors = await usersCollection.countDocuments({
        role: "Vendor",
      });
      const totalCustomers = await usersCollection.countDocuments({
        role: "Customer",
      });
      const totalServices = await servicesCollection.countDocuments();
      const pendingServices = await servicesCollection.countDocuments({
        status: "Pending",
      });
      const totalTransactions = await transactionsCollection.countDocuments();
      return res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalVendors,
          totalCustomers,
          totalServices,
          pendingServices,
          totalTransactions,
        },
      });
    }

    if (role === "Vendor") {
      const totalServices = await servicesCollection.countDocuments({
        vendorId: userId,
      });
      const activeServices = await servicesCollection.countDocuments({
        vendorId: userId,
        status: "Approved",
        isActive: true,
      });
      const pendingRequests = await bookingsCollection.countDocuments({
        vendorId: userId,
        status: "Pending",
      });
      const acceptedBookings = await bookingsCollection.countDocuments({
        vendorId: userId,
        status: "Accepted",
      });
      return res.status(200).json({
        success: true,
        data: {
          totalServices,
          activeServices,
          pendingRequests,
          acceptedBookings,
          subscriptionPlan: req.user.subscriptionPlan || "Free",
        },
      });
    }

    const totalBookings = await bookingsCollection.countDocuments({
      customerId: userId,
    });
    const pendingBookings = await bookingsCollection.countDocuments({
      customerId: userId,
      status: "Pending",
    });
    const acceptedBookings = await bookingsCollection.countDocuments({
      customerId: userId,
      status: "Accepted",
    });
    const rejectedBookings = await bookingsCollection.countDocuments({
      customerId: userId,
      status: "Rejected",
    });
    return res.status(200).json({
      success: true,
      data: {
        totalBookings,
        pendingBookings,
        acceptedBookings,
        rejectedBookings,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load stats." });
  }
});

export default router;

