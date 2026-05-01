/**
 * presidioService.js
 *
 * Thin Axios wrapper around the Presidio Analyzer container.
 * Returns the raw entity array so callers can use both character
 * offsets (for text masking) and entity_type (for reporting).
 *
 * Shape of each entity:
 *   { entity_type: string, start: number, end: number, score: number }
 */
 
import axios from "axios";
 
const PRESIDIO_URL = process.env.PRESIDIO_URL || "http://localhost:5001/analyze";
 
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