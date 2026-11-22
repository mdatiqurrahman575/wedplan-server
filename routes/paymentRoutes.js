// import express from "express";
// import Stripe from "stripe";
// import dotenv from "dotenv";
// import { ObjectId } from "mongodb";
// import { getCollections } from "../config/db.js";
// import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";

// dotenv.config();

// const router = express.Router();
// const stripe = new Stripe(
//   process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key_12345",
// );

// // ১. Stripe Webhook Handler (index.js-এ সরাসরি ব্যবহৃত হবে)
// export const stripeWebhookHandler = async (req, res) => {
//   const sig = req.headers["stripe-signature"];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET,
//     );
//   } catch (err) {
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   if (event.type === "checkout.session.completed") {
//     const session = event.data.object;
//     const vendorId = session.metadata?.vendorId;

//     if (vendorId) {
//       const { usersCollection, transactionsCollection } = getCollections();
//       const expiresAt = new Date();
//       expiresAt.setDate(expiresAt.getDate() + 30);

//       await usersCollection.updateOne(
//         { _id: new ObjectId(vendorId) },
//         {
//           $set: {
//             subscriptionPlan: "Premium",
//             subscriptionExpiresAt: expiresAt,
//           },
//         },
//       );

//       await transactionsCollection.insertOne({
//         vendorId,
//         vendorEmail: session.customer_details?.email || "",
//         plan: "Premium",
//         amount: (session.amount_total || 0) / 100,
//         currency: session.currency || "usd",
//         stripeSessionId: session.id,
//         stripeSubscriptionId:
//           session.subscription || session.payment_intent || "",
//         status: "Succeeded",
//         createdAt: new Date(),
//       });
//     }
//   }

//   res.status(200).json({ received: true });
// };

// // ২. ভেন্ডর: Stripe Checkout Session তৈরি
// router.post(
//   "/payments/create-checkout-session",
//   verifyToken,
//   verifyRole("Vendor"),
//   async (req, res) => {
//     try {
//       if (req.user.subscriptionPlan === "Premium") {
//         return res.status(400).json({
//           success: false,
//           message: "You are already on the Premium plan!",
//         });
//       }

//       const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
//       const session = await stripe.checkout.sessions.create({
//         mode: "payment",
//         customer_email: req.user.email,
//         line_items: [
//           {
//             price_data: {
//               currency: "usd",
//               product_data: {
//                 name: "WedPlan Vendor Premium Plan",
//                 description:
//                   "Unlimited active wedding services and priority promotion",
//               },
//               unit_amount: 2900,
//             },
//             quantity: 1,
//           },
//         ],
//         metadata: { vendorId: req.user._id.toString() },
//         success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${clientUrl}/payment/cancel`,
//       });

//       res.status(200).json({ success: true, url: session.url });
//     } catch (error) {
//       console.error("Stripe Checkout Error:", error);
//       res.status(500).json({
//         success: false,
//         message: error.message || "Failed to create payment session.",
//       });
//     }
//   },
// );

// // ৩. অ্যাডমিন: সব ট্রানজেকশন দেখা (Read-Only)
// router.get(
//   "/admin/transactions",
//   verifyToken,
//   verifyRole("Admin"),
//   async (req, res) => {
//     try {
//       const { transactionsCollection } = getCollections();
//       const transactions = await transactionsCollection
//         .find()
//         .sort({ createdAt: -1 })
//         .toArray();
//       res.status(200).json({ success: true, data: transactions });
//     } catch (error) {
//       res
//         .status(500)
//         .json({ success: false, message: "Failed to load transactions." });
//     }
//   },
// );

// export default router;

import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";

dotenv.config();

const router = express.Router();
const stripe = new Stripe(
  (process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key_12345").trim(),
);

// ১. Stripe Webhook Handler (index.js-এ সরাসরি ব্যবহৃত হবে)
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
    );
  } catch (err) {
    console.error("Webhook Signature Verification Failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const vendorId = session.metadata?.vendorId;

    if (vendorId) {
      try {
        const { usersCollection, transactionsCollection } = getCollections();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await usersCollection.updateOne(
          { _id: new ObjectId(vendorId) },
          {
            $set: {
              subscriptionPlan: "Premium",
              subscriptionExpiresAt: expiresAt,
            },
          },
        );

        await transactionsCollection.insertOne({
          vendorId,
          vendorEmail: session.customer_details?.email || "",
          plan: "Premium",
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "usd",
          stripeSessionId: session.id,
          stripeSubscriptionId:
            session.subscription || session.payment_intent || "",
          status: "Succeeded",
          createdAt: new Date(),
        });

        console.log(`Vendor (${vendorId}) successfully upgraded to Premium!`);
      } catch (dbError) {
        console.error("Webhook DB Update Error:", dbError);
        return res
          .status(500)
          .json({ success: false, message: "Database update failed" });
      }
    }
  }

  res.status(200).json({ received: true });
};

// ২. ভেন্ডর: Stripe Checkout Session তৈরি
router.post(
  "/payments/create-checkout-session",
  verifyToken,
  verifyRole("Vendor"),
  async (req, res) => {
    try {
      if (req.user.subscriptionPlan === "Premium") {
        return res.status(400).json({
          success: false,
          message: "You are already on the Premium plan!",
        });
      }

      // অদৃশ্য স্পেস বা নিউলাইন পরিষ্কার করে সঠিক URL নিশ্চিত করা
      let rawClientUrl = (
        process.env.CLIENT_URL || "https://vercel.app"
      ).trim();

      if (!rawClientUrl.startsWith("http")) {
        rawClientUrl = `https://${rawClientUrl}`;
      }
      const clientUrl = rawClientUrl.replace(/\/+$/, "");

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ...(req.user.email ? { customer_email: req.user.email.trim() } : {}),
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "WedPlan Vendor Premium Plan",
                description:
                  "Unlimited active wedding services and priority promotion",
              },
              unit_amount: 2900,
            },
            quantity: 1,
          },
        ],
        metadata: { vendorId: req.user._id.toString() },
        success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/payment/cancel`,
      });

      res.status(200).json({ success: true, url: session.url });
    } catch (error) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create payment session.",
      });
    }
  },
);

// ৩. অ্যাডমিন: সব ট্রানজেকশন দেখা (Read-Only)
router.get(
  "/admin/transactions",
  verifyToken,
  verifyRole("Admin"),
  async (req, res) => {
    try {
      const { transactionsCollection } = getCollections();
      const transactions = await transactionsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.status(200).json({ success: true, data: transactions });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to load transactions." });
    }
  },
);

export default router;
