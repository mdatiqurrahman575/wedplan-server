import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ১. কাস্টমার: নতুন বুকিং তৈরি
router.post(
  "/bookings",
  verifyToken,
  verifyRole("Customer"),
  async (req, res) => {
    try {
      const { serviceId, eventDate, eventLocation, message } = req.body;
      if (!serviceId || !eventDate || !eventLocation) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Service, event date, and location are required.",
          });
      }
      if (!ObjectId.isValid(serviceId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid Service ID." });

      const { servicesCollection, bookingsCollection } = getCollections();
      const service = await servicesCollection.findOne({
        _id: new ObjectId(serviceId),
      });
      if (!service || service.status !== "Approved" || !service.isActive) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Service is not available for booking.",
          });
      }

      const customerId = req.user._id.toString();
      if (service.vendorId === customerId) {
        return res
          .status(403)
          .json({
            success: false,
            message: "You cannot book your own service.",
          });
      }

      const duplicateBooking = await bookingsCollection.findOne({
        serviceId,
        customerId,
        eventDate,
        status: { $in: ["Pending", "Accepted"] },
      });
      if (duplicateBooking) {
        return res
          .status(409)
          .json({
            success: false,
            message: "Duplicate active booking for this service and date.",
          });
      }

      const newBooking = {
        serviceId,
        serviceName: service.serviceName,
        serviceImage: service.images?.[0] || "",
        servicePrice: service.price,
        vendorId: service.vendorId,
        vendorName: service.vendorName,
        customerId,
        customerName: req.user.name,
        customerEmail: req.user.email,
        eventDate,
        eventLocation,
        message: message || "",
        status: "Pending",
        createdAt: new Date(),
      };

      const result = await bookingsCollection.insertOne(newBooking);
      res
        .status(201)
        .json({
          success: true,
          message: "Booking request submitted!",
          insertedId: result.insertedId,
        });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to submit booking request." });
    }
  },
);

// ২. কাস্টমার: নিজের বুকিং দেখা
router.get(
  "/customer/my-bookings",
  verifyToken,
  verifyRole("Customer"),
  async (req, res) => {
    try {
      const { bookingsCollection } = getCollections();
      const bookings = await bookingsCollection
        .find({ customerId: req.user._id.toString() })
        .sort({ createdAt: -1 })
        .toArray();
      res.status(200).json({ success: true, data: bookings });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch your bookings." });
    }
  },
);

// ৩. কাস্টমার: Pending বুকিং Cancel করা
router.patch(
  "/bookings/:id/cancel",
  verifyToken,
  verifyRole("Customer"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid Booking ID." });

      const { bookingsCollection } = getCollections();
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!booking)
        return res
          .status(404)
          .json({ success: false, message: "Booking not found." });
      if (booking.customerId !== req.user._id.toString()) {
        return res
          .status(403)
          .json({
            success: false,
            message: "You can only cancel your own bookings.",
          });
      }
      if (booking.status !== "Pending") {
        return res
          .status(400)
          .json({
            success: false,
            message: `Cannot cancel a ${booking.status} booking.`,
          });
      }

      await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Cancelled" } },
      );
      res
        .status(200)
        .json({ success: true, message: "Booking cancelled successfully." });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to cancel booking." });
    }
  },
);

// ৪. ভেন্ডর: বুকিং রিকোয়েস্ট দেখা
router.get(
  "/vendor/booking-requests",
  verifyToken,
  verifyRole("Vendor"),
  async (req, res) => {
    try {
      const { bookingsCollection } = getCollections();
      const requests = await bookingsCollection
        .find({ vendorId: req.user._id.toString() })
        .sort({ createdAt: -1 })
        .toArray();
      res.status(200).json({ success: true, data: requests });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch booking requests." });
    }
  },
);

// ৫. ভেন্ডর: বুকিং Accept বা Reject করা
router.patch(
  "/bookings/:id/status",
  verifyToken,
  verifyRole("Vendor"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!ObjectId.isValid(id) || !["Accepted", "Rejected"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Booking ID or status." });
      }

      const { bookingsCollection } = getCollections();
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!booking)
        return res
          .status(404)
          .json({ success: false, message: "Booking not found." });
      if (booking.vendorId !== req.user._id.toString()) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Unauthorized to manage this booking.",
          });
      }
      if (booking.status !== "Pending") {
        return res
          .status(400)
          .json({
            success: false,
            message: `Booking is already ${booking.status}.`,
          });
      }

      await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } },
      );
      res
        .status(200)
        .json({
          success: true,
          message: `Booking request ${status.toLowerCase()}!`,
        });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to update booking status." });
    }
  },
);

export default router;

