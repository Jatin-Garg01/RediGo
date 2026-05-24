const express = require("express");
const bcrypt = require("bcrypt");


const {signup , signin} = require("../controllers/authController");
const User = require("../models/User");

const router = express.Router();

router.post("/signup", signup);
router.post("/signin/email", signin);
router.post("/signin/facebook", signin);



module.exports = router;