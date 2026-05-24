const authService = require("../service/authService");

const signup = async (req, res) => {
  try {
    const { name, email, password,  } = req.body;
    const user = await authService.signup({
     name,
     email,
     password,
    });
    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const signin = async (req, res) => {
     try {
       const { email, password } = req.body;
       const user = await authService.signin({ email, password });
       res.status(200).json({ message: "User logged in successfully", user });
     } catch (error) {
       res.status(400).json({ error: error.message });
     }
};
module.exports = { signup, signin };