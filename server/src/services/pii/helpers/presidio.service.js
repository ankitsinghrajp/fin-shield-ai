
import axios from "axios";
 
const PRESIDIO_URL = process.env.PRESIDIO_URL;
 
/**
 * @param {string} text
 * @returns {Promise<Array>}  raw Presidio entity array, or [] on failure
 */
export const analyzeTextWithPresidio = async (text) => {
  try {
    const res = await axios.post(
      PRESIDIO_URL,
      { text, language: "en" },
      { timeout: 8000 }
    );
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.warn("[presidioService] Presidio unavailable:", err.message);
    return [];
  }
};