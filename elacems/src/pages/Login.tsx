import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import logo from "../assets/logo.png";
import logo2 from "../assets/ublogo.png";
import axios from "axios";

const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
  clientId?: string;
}

interface GoogleUserData {
  email: string;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
  [key: string]: any;
}

interface UserData {
  email: string;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
  role: string;
}

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // ⬅ NEW
  const navigate = useNavigate();

  const routeAfterLogin = (email: string, role: string) => {
    const lowerEmail = (email || "").toLowerCase();

    if (role === "Instructor" || role === "Program Chair") {
      navigate("/facultyreserve");
      return;
    }
    if (role === "Student" && lowerEmail.endsWith("@s.ubaguio.edu")) {
      navigate("/studentprep");
      return;
    }
    if (role === "Admin" || role === "Student Assistant" || role === "Custodian") {
      navigate("/dashboard");
      return;
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser || "{}");
        const role = u.role || "";
        const email = u.email || "";
        routeAfterLogin(email, role);
      } catch {
        navigate("/dashboard", { replace: true });
      }
      return;
    }

    // Google Login initialize
    /* global google */
    window.google.accounts.id.initialize({
      client_id:
        "567905636161-p7b5sl4h4vig665cbst2sqgd4afph7k7.apps.googleusercontent.com",
      callback: handleCredentialResponse,
    });

    // Google button centered
    window.google.accounts.id.renderButton(
      document.getElementById("google-login-button")!,
      {
        theme: "filled_blue",
        size: "large",
        width: "250px",
      }
    );

    window.google.accounts.id.prompt();
  }, [navigate]);

  const handleCredentialResponse = async (response: GoogleCredentialResponse) => {
    setLoading(true); // ⬅ START LOADING
    setError("");

    try {
      const userData = parseJwt(response.credential) as GoogleUserData;
      const email = (userData.email || "").toLowerCase();

      if (!isAllowedEmail(email)) {
        setError(
          "❌ Please use your UB school email (@s.ubaguio.edu, @e.ubaguio.edu)"
        );
        setLoading(false); // stop loading
        return;
      }

      try {
        const findResp = await axios.post(`${API_BASE_URL}/users`, {
          action: "read",
          email: userData.email,
        });
        const found =
          findResp.data?.data && findResp.data.data.length > 0
            ? findResp.data.data[0]
            : null;

        if (found) {
          await updateUserWithGoogleData(userData, found).catch(() => {});
          const role = found.role || determineRoleFromEmail(email);
          const completeUserData: UserData = { ...userData, role };
          localStorage.setItem("user", JSON.stringify(completeUserData));

          routeAfterLogin(email, role);
          return;
        }
      } catch {}

      // Not found in DB
      if (email.endsWith("@s.ubaguio.edu")) {
        // Create new user in DB with role Student
        try {
          await axios.post(`${API_BASE_URL}/users`, {
            action: "create",
            email: userData.email,
            firstname: userData.given_name || userData.name?.split(" ")[0] || "",
            lastname: userData.family_name || userData.name?.split(" ").slice(1).join(" ") || "",
            role: "Student"
          });
        } catch (err) {
          // Ignore error if already exists
        }
        const completeUserData: UserData = { ...userData, role: "Student" };
        localStorage.setItem("user", JSON.stringify(completeUserData));
        navigate("/studentprep");
        return;
      }

      const role = await createNewUser(userData);
      const completeUserData: UserData = { ...userData, role };
      localStorage.setItem("user", JSON.stringify(completeUserData));
      routeAfterLogin(email, role);
    } catch (err) {
      console.error(err);
      setError("Something went wrong during login");
    } finally {
      setLoading(false); // ⬅ STOP LOADING
    }
  };

  const isAllowedEmail = (email: string): boolean => {
    const allowedDomains = ["@s.ubaguio.edu", "@e.ubaguio.edu"];
    const allowedEmails = ["ubaguioelams@gmail.com"];

    return (
      allowedDomains.some((domain) => email.endsWith(domain)) ||
      allowedEmails.includes(email)
    );
  };

  const determineRoleFromEmail = (email: string): string => {
    if (email.endsWith("@s.ubaguio.edu")) return "Student";
    if (email.endsWith("@e.ubaguio.edu")) return "Faculty";
    if (email === "ubaguioelams@gmail.com") return "Admin";
    return "Student";
  };

  const updateUserWithGoogleData = async (userData: GoogleUserData, existingUser: any) => {
    try {
      const { firstName, lastName } = extractNames(userData);

      if (
        existingUser.firstname !== firstName ||
        existingUser.lastname !== lastName
      ) {
        await axios.post(`${API_BASE_URL}/users`, {
          action: "update",
          email: userData.email,
          firstname: firstName,
          lastname: lastName,
          role: existingUser.role,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const extractMessage = (obj: any) => {
    if (!obj) return "";
    if (obj?.data?.message) return obj.data.message;
    if (obj.message) return obj.message;
    return String(obj);
  };

  const createNewUser = async (userData: GoogleUserData): Promise<string> => {
    try {
      const role = determineRoleFromEmail(userData.email);
      const { firstName, lastName } = extractNames(userData);

      const createResponse = await axios.post(`${API_BASE_URL}/users`, {
        action: "create",
        email: userData.email,
        firstname: firstName,
        lastname: lastName,
        role: role,
      });

      if (createResponse.data.success) return role;
      throw new Error("Failed to create user");
    } catch (err: any) {
      const errMsg = extractMessage(err);
      if (errMsg.includes("already exists")) {
        const find = await axios.post(`${API_BASE_URL}/users`, {
          action: "read",
          email: userData.email,
        });
        return find.data.data[0].role;
      }
      throw err;
    }
  };

  const extractNames = (userData: GoogleUserData) => {
    if (userData.email === "ubaguioelams@gmail.com")
      return { firstName: "System", lastName: "Admin" };

    if (userData.given_name && userData.family_name)
      return {
        firstName: userData.given_name,
        lastName: userData.family_name,
      };

    if (userData.name) {
      const p = userData.name.trim().split(" ");
      return p.length === 1
        ? { firstName: p[0], lastName: "User" }
        : { firstName: p[0], lastName: p.slice(1).join(" ") };
    }

    return extractNamesFromEmail(userData.email);
  };

  const extractNamesFromEmail = (email: string) => {
    const pre = email.split("@")[0];
    if (pre.includes(".")) {
      const [f, l] = pre.split(".");
      return {
        firstName: capitalizeFirstLetter(f),
        lastName: capitalizeFirstLetter(l),
      };
    }
    return { firstName: capitalizeFirstLetter(pre), lastName: "User" };
  };

  const capitalizeFirstLetter = (str: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "User";

  function parseJwt(token: string): object {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  }

  return (
    <div className="login-container">

      {/* ⬅ LOADING OVERLAY */}
      {loading && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <p>Logging you in…</p>
        </div>
      )}

      <div className="login-card">
        <div className="logo-wrapper">
          <img src={logo2} alt="University of Baguio" className="logo" />
          <img src={logo} alt="University of Baguio" className="logo" />
        </div>

        <h1 className="title">University of Baguio</h1>
        <p className="subtitle">ECE Laboratory Asset Management System</p>

        {error && <p className="alert error">{error}</p>}

        {/* GOOGLE BUTTON (centered) */}
        <div
          id="google-login-button"
          style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}
        ></div>

        <div className="footer">
          <p>
            © {new Date().getFullYear()} University of Baguio <br />
            <span className="highlight">Philippines</span>
          </p>
        </div>
      </div>
    </div>
  );
}
