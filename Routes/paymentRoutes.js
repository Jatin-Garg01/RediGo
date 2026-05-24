// const express = require("express");
// const Razorpay = require("razorpay");
// const crypto = require("crypto");
// const router = express.Router();

// // ✅ Debug environment variables
// console.log("🔍 Environment check in paymentRoutes:");
// console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 10)}...` : "❌ Missing");
// console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "✅ Loaded" : "❌ Missing");

// // ✅ Initialize Razorpay instance with better error handling
// let razorpay;
// try {
//   if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
//     throw new Error("Missing Razorpay credentials in environment variables");
//   }
  
//   razorpay = new Razorpay({
//     key_id: process.env.RAZORPAY_KEY_ID,
//     key_secret: process.env.RAZORPAY_KEY_SECRET,
//   });
//   console.log("✅ Razorpay initialized successfully");
// } catch (error) {
//   console.error("❌ Razorpay initialization failed:", error.message);
// }

// // ✅ Test route FIRST - to check if routes are accessible
// router.get("/test", (req, res) => {
//   console.log("🧪 Test route accessed");
//   res.json({
//     success: true,
//     message: "Payment routes are working!",
//     razorpayConfigured: !!razorpay,
//     environment: {
//       hasKeyId: !!process.env.RAZORPAY_KEY_ID,
//       hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
//       nodeEnv: process.env.NODE_ENV || 'development'
//     },
//     timestamp: new Date().toISOString()
//   });
// });

// // ✅ Create Order Route
// // In your paymentRoutes.js create-order route
// router.post("/create-order", async (req, res) => {
//   try {
//     console.log("📝 Create order request received");
//     const { amount, rideId, userId } = req.body;

//     // ✅ Validation...
//     if (!razorpay) {
//       return res.status(500).json({
//         success: false,
//         message: "Payment service not available"
//       });
//     }

//     // ✅ Create a shorter receipt (max 40 characters)
//     const shortRideId = rideId.slice(-8); // Take last 8 characters
//     const timestamp = Date.now().toString().slice(-6); // Take last 6 digits
//     const shortReceipt = `ride_${shortRideId}_${timestamp}`; // This will be ~20 characters
    
//     console.log("🧾 Receipt created:", shortReceipt, "Length:", shortReceipt.length);

//     const options = {
//       amount: Number(amount) * 100, // Convert to paise
//       currency: "INR",
//       receipt: shortReceipt, // ✅ Use shorter receipt
//       payment_capture: 1,
//     };

//     console.log("🔄 Creating Razorpay order with options:", options);
    
//     const order = await razorpay.orders.create(options);
//     console.log("✅ Order created successfully:", order.id);
    
//     res.status(200).json({
//       success: true,
//       order: order,
//       key_id: process.env.RAZORPAY_KEY_ID,
//     });
    
//   } catch (error) {
//     console.error("❌ Create order error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create order",
//       error: error.message,
//       razorpayError: error.error // Include Razorpay specific error
//     });
//   }
// });

// // ✅ Verify Payment Route
// router.post("/verify-payment", async (req, res) => {
//   try {
//     console.log("🔍 Verify payment request received");
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature, rideId, userId } = req.body;

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing payment verification data"
//       });
//     }

//     // Create signature for verification
//     const body = razorpay_order_id + "|" + razorpay_payment_id;
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body.toString())
//       .digest("hex");

//     const isAuthentic = expectedSignature === razorpay_signature;

//     if (isAuthentic) {
//       console.log("✅ Payment verified successfully");
      
//       res.status(200).json({
//         success: true,
//         message: "Payment verified successfully",
//         paymentId: razorpay_payment_id,
//         orderId: razorpay_order_id,
//         rideId: rideId
//       });
//     } else {
//       console.log("❌ Payment verification failed - signature mismatch");
//       res.status(400).json({
//         success: false,
//         message: "Payment verification failed"
//       });
//     }
//   } catch (error) {
//     console.error("❌ Payment verification error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Payment verification error",
//       error: error.message,
//     });
//   }

  
// });


// module.exports = router;



const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Ride = require("../models/Ride");
const User = require("../models/User");
const { protect } = require("../middlewares/protect");

// ✅ Debug environment variables
console.log("🔍 Environment check in paymentRoutes:");
console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 10)}...` : "❌ Missing");
console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "✅ Loaded" : "❌ Missing");

// ✅ Initialize Razorpay instance with better error handling
let razorpay;
try {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Missing Razorpay credentials in environment variables");
  }
  
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log("✅ Razorpay initialized successfully");
} catch (error) {
  console.error("❌ Razorpay initialization failed:", error.message);
}

// ✅ Test route FIRST - to check if routes are accessible
router.get("/test", (req, res) => {
  console.log("🧪 Test route accessed");
  res.json({
    success: true,
    message: "Payment routes are working!",
    razorpayConfigured: !!razorpay,
    environment: {
      hasKeyId: !!process.env.RAZORPAY_KEY_ID,
      hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ Create Order Route
router.post("/create-order", async (req, res) => {
  try {
    console.log("📝 Create order request received");
    console.log("📝 Request body:", req.body);
    
    const { amount, rideId, userId } = req.body;

    // ✅ Enhanced validation
    if (!amount || !rideId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: amount, rideId, userId",
        received: { amount, rideId, userId }
      });
    }

    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: "Payment service not available. Razorpay not configured."
      });
    }

    // ✅ Validate amount
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount provided"
      });
    }

    // ✅ Create a shorter receipt (max 40 characters)
    const shortRideId = rideId.slice(-8); // Take last 8 characters
    const timestamp = Date.now().toString().slice(-6); // Take last 6 digits
    const shortReceipt = `ride_${shortRideId}_${timestamp}`; // This will be ~20 characters
    
    console.log("🧾 Receipt created:", shortReceipt, "Length:", shortReceipt.length);

    const options = {
      amount: numAmount * 100, // Convert to paise
      currency: "INR",
      receipt: shortReceipt,
      payment_capture: 1,
    };

    console.log("🔄 Creating Razorpay order with options:", options);
    
    const order = await razorpay.orders.create(options);
    console.log("✅ Order created successfully:", order.id);
    
    res.status(200).json({
      success: true,
      order: order,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
    
  } catch (error) {
    console.error("❌ Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
      razorpayError: error.error // Include Razorpay specific error
    });
  }
});

// ✅ ADDED: Verify Payment Route
router.post("/verify-payment", async (req, res) => {
  try {
    console.log("🔐 Payment verification request received");
    console.log("🔐 Request body:", req.body);
    
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      rideId,
      userId
    } = req.body;

    // ✅ Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification data"
      });
    }

    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: "Payment service not available"
      });
    }

    // ✅ Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    console.log("🔐 Expected signature:", expectedSignature);
    console.log("🔐 Received signature:", razorpay_signature);

    if (expectedSignature !== razorpay_signature) {
      console.error("❌ Signature verification failed");
      return res.status(400).json({
        success: false,
        message: "Payment verification failed - Invalid signature"
      });
    }

    console.log("✅ Payment signature verified successfully");

    // ✅ Fetch payment details from Razorpay
    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      console.log("💳 Payment details fetched:", {
        id: paymentDetails.id,
        amount: paymentDetails.amount,
        status: paymentDetails.status,
        method: paymentDetails.method
      });
    } catch (fetchError) {
      console.error("❌ Error fetching payment details:", fetchError);
      paymentDetails = null;
    }

    // ✅ Save transaction to database
    try {
      const transaction = new Transaction({
        userId: userId,
        rideId: rideId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        amount: paymentDetails ? paymentDetails.amount / 100 : 0, // Convert from paise
        currency: paymentDetails ? paymentDetails.currency : 'INR',
        status: 'completed',
        paymentMethod: paymentDetails ? paymentDetails.method : 'unknown',
        createdAt: new Date()
      });

      await transaction.save();
      console.log("💾 Transaction saved:", transaction._id);

      // ✅ Update ride status (mark as paid)
      if (rideId) {
        try {
          const ride = await Ride.findById(rideId);
          if (ride) {
            // Add user to passengers if not already added
            const isAlreadyPassenger = ride.passengers.some(p => 
              p.userId.toString() === userId.toString()
            );

            if (!isAlreadyPassenger) {
              ride.passengers.push({
                userId: userId,
                paymentStatus: 'completed',
                paymentId: razorpay_payment_id,
                bookedAt: new Date()
              });
              
              await ride.save();
              console.log("🚗 User added to ride passengers");
            } else {
              // Update payment status for existing passenger
              const passengerIndex = ride.passengers.findIndex(p => 
                p.userId.toString() === userId.toString()
              );
              if (passengerIndex !== -1) {
                ride.passengers[passengerIndex].paymentStatus = 'completed';
                ride.passengers[passengerIndex].paymentId = razorpay_payment_id;
                await ride.save();
                console.log("🚗 Passenger payment status updated");
              }
            }
          }
        } catch (rideError) {
          console.error("❌ Error updating ride:", rideError);
        }
      }

      // ✅ Send success response
      res.status(200).json({
        success: true,
        message: "Payment verified and transaction saved successfully",
        transaction: {
          id: transaction._id,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          amount: transaction.amount,
          status: transaction.status
        },
        paymentDetails: paymentDetails ? {
          method: paymentDetails.method,
          bank: paymentDetails.bank,
          wallet: paymentDetails.wallet,
          vpa: paymentDetails.vpa
        } : null
      });

    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      
      // Even if DB save fails, payment is successful
      res.status(200).json({
        success: true,
        message: "Payment verified successfully (transaction logging failed)",
        warning: "Transaction details could not be saved to database",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      });
    }

  } catch (error) {
    console.error("❌ Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message
    });
  }
});

// ✅ ADDED: Get Payment History
router.get("/history", protect, async (req, res) => {
  try {
    console.log("📋 Fetching payment history for user:", req.user._id);
    
    const transactions = await Transaction.find({ userId: req.user._id })
      .populate('rideId', 'from to date price')
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`📋 Found ${transactions.length} transactions`);

    res.status(200).json({
      success: true,
      transactions,
      count: transactions.length
    });

  } catch (error) {
    console.error("❌ Error fetching payment history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error.message
    });
  }
});

// ✅ ADDED: Get Transaction Details
router.get("/transaction/:transactionId", protect, async (req, res) => {
  try {
    const { transactionId } = req.params;
    console.log("🔍 Fetching transaction details:", transactionId);
    
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: req.user._id // Ensure user can only see their own transactions
    }).populate('rideId', 'from to date price driverId')
      .populate('userId', 'name email');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.status(200).json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error("❌ Error fetching transaction details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction details",
      error: error.message
    });
  }
});

// ✅ ADDED: Refund Payment (for cancellations)
router.post("/refund", protect, async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;
    console.log("💸 Refund request:", { paymentId, amount, reason });

    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: "Payment service not available"
      });
    }

    // ✅ Create refund
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100, // Convert to paise
      reason: reason || 'requested_by_customer'
    });

    console.log("✅ Refund created:", refund.id);

    // ✅ Update transaction status
    await Transaction.findOneAndUpdate(
      { razorpayPaymentId: paymentId, userId: req.user._id },
      { 
        status: 'refunded',
        refundId: refund.id,
        refundAmount: amount,
        refundedAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: "Refund processed successfully",
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });

  } catch (error) {
    console.error("❌ Refund error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message
    });
  }
});

module.exports = router;