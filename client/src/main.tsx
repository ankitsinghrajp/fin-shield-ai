import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Provider } from "react-redux";
import {GoogleOAuthProvider} from "@react-oauth/google"
import { store } from "./redux/store.ts";

createRoot(document.getElementById("root")!).render(
    <Provider store={store}>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </Provider>,
);
