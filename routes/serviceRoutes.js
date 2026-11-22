import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ১. পাবলিক: সব Approved & Active সার্ভিস দেখা (Search, Filter, Sort, Featured)
router.get("/services", async (req, res) => {
  try {
    const { servicesCollection } = getCollections();
    const { search, category, location, sort, limit } = req.query;

    const query = { status: "Approved", isActive: true };
    if (search) query.serviceName = { $regex: search, $options: "i" };
    if (category && category !== "All") query.category = category;
    if (location) query.location = { $regex: location, $options: "i" };

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    if (sort === "price_desc") sortOption = { price: -1 };

    let cursor = servicesCollection.find(query).sort(sortOption);
    if (limit) cursor = cursor.limit(parseInt(limit));

    const services = await cursor.toArray();
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch services." });
  }
});

// ২. প্রোটেক্টেড: নির্দিষ্ট একটি সার্ভিসের বিস্তারিত দেখা
router.get("/services/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Service ID." });
    }

    const { servicesCollection, usersCollection } = getCollections();
    const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found." });
    }

    const vendor = await usersCollection.findOne({
      _id: new ObjectId(service.vendorId),
    });
    res.status(200).json({
      success: true,
      data: {
        ...service,
        vendorInfo: vendor
          ? {
              name: vendor.name,
              email: vendor.email,
              businessName: vendor.businessName,
              image: vendor.image,
            }
          : null,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching service details." });
  }
});

// ৩. ভেন্ডর: নতুন সার্ভিস যোগ (Free প্ল্যানে সর্বোচ্চ ৩টি সার্ভিস)
router.post(
  "/services",
  verifyToken,
  verifyRole("Vendor"),
  async (req, res) => {
    try {
      const { serviceName, category, description, price, location, images } =
        req.body;
      if (
        !serviceName ||
        !category ||
        !description ||
        !price ||
        !location ||
        !images?.length
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "All fields and at least one image are required.",
          });
      }

      const { servicesCollection } = getCollections();
      const vendorId = req.user._id.toString();
      const plan = req.user.subscriptionPlan || "Free";

      if (plan === "Free") {
        const existingCount = await servicesCollection.countDocuments({
          vendorId,
          status: { $ne: "Rejected" },
        });
        if (existingCount >= 3) {
          return res.status(403).json({
            success: false,
            message:
              "Free plan limit reached (Max 3 services). Upgrade to Premium!",
          });
        }
      }

      const newService = {
        vendorId,
        vendorName: req.user.name,
        vendorEmail: req.user.email,
        serviceName,
        category,
        description,
        price: parseFloat(price),
        location,
        images: Array.isArray(images) ? images : [images],
        status: "Pending",
        isActive: true,
        createdAt: new Date(),
      };

      const result = await servicesCollection.insertOne(newService);
      res
        .status(201)
        .json({
          success: true,
          message: "Service submitted for Admin approval!",
          insertedId: result.insertedId,
        });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to create service." });
    }
  },
);

// ৪. ভেন্ডর: নিজের সার্ভিস দেখা
router.get(
  "/vendor/my-services",
  verifyToken,
  verifyRole("Vendor"),
  async (req, res) => {
    try {
      const { servicesCollection } = getCollections();
      const services = await servicesCollection
        .find({ vendorId: req.user._id.toString() })
        .sort({ createdAt: -1 })
        .toArray();
      res.status(200).json({ success: true, data: services });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch your services." });
    }
  },
);

// ৫. ভেন্ডর: নিজের সার্ভিস আপডেট বা Active/Inactive টগল
router.patch(
  "/services/:id",
  verifyToken,
  verifyRole("Vendor"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid Service ID." });

      const { servicesCollection } = getCollections();
      const service = await servicesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!service)
        return res
          .status(404)
          .json({ success: false, message: "Service not found." });
      if (service.vendorId !== req.user._id.toString()) {
        return res
          .status(403)
          .json({
            success: false,
            message: "You can only update your own services.",
          });
      }

      const {
        serviceName,
        category,
        description,
        price,
        location,
        images,
        isActive,
      } = req.body;
      const updateFields = {};
      if (serviceName !== undefined) updateFields.serviceName = serviceName;
      if (category !== undefined) updateFields.category = category;
      if (description !== undefined) updateFields.description = description;
      if (price !== undefined) updateFields.price = parseFloat(price);
      if (location !== undefined) updateFields.location = location;
      if (images !== undefined) updateFields.images = images;
      if (isActive !== undefined) updateFields.isActive = Boolean(isActive);

      await servicesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields },
      );
      res
        .status(200)
        .json({ success: true, message: "Service updated successfully!" });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to update service." });
    }
  },
);

// ৬. ভেন্ডর বা অ্যাডমিন: সার্ভিস ডিলিট
router.delete(
  "/services/:id",
  verifyToken,
  verifyRole("Vendor", "Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid Service ID." });

      const { servicesCollection } = getCollections();
      const service = await servicesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!service)
        return res
          .status(404)
          .json({ success: false, message: "Service not found." });

      if (
        req.user.role === "Vendor" &&
        service.vendorId !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Unauthorized to delete this service.",
          });
      }

      await servicesCollection.deleteOne({ _id: new ObjectId(id) });
      res
        .status(200)
        .json({ success: true, message: "Service deleted successfully!" });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to delete service." });
    }
  },
);

export default router;
