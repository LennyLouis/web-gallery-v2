import { useEffect } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Les photos de Lenny" },
    { name: "description", content: "Plateforme sécurisée de partage de photos professionnelles" },
  ];
}

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirection côté client pour le mode SPA
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
}
