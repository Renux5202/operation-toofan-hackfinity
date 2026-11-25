import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import PayDemo from "./PayDemo.jsx";
import AnonymousTipPage from "./AnonymousTipPage.jsx";
import "./styles.css";

const path = window.location.pathname;
const Page = path.startsWith("/pay")
  ? PayDemo
  : path.startsWith("/tip")
  ? AnonymousTipPage
  : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
