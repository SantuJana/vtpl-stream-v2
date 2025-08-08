import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://api.example.com",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

export default axiosInstance;