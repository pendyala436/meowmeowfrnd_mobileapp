import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRegistrationGuard } from "@/hooks/useRegistrationGuard";

/**
 * Language preferences were removed from registration.
 * Mother tongue is chosen earlier on LanguageCountryScreen (`selectedLanguage`).
 * This route only forwards so old links/bookmarks do not show a second picker.
 */
const LanguagePreferencesScreen = () => {
  const navigate = useNavigate();
  useRegistrationGuard([{ key: "userEmail" }, { key: "userGender" }], "/basic-info");

  useEffect(() => {
    const mother = sessionStorage.getItem("selectedLanguage");
    if (mother) {
      sessionStorage.setItem("userPrimaryLanguage", mother);
    }
    // Do not re-prompt for languages
    sessionStorage.removeItem("userLanguagePreferences");
    navigate("/password-setup", { replace: true });
  }, [navigate]);

  return null;
};

export default LanguagePreferencesScreen;
