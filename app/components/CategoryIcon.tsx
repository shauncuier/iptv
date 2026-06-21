import {
  Film, Newspaper, Trophy, Music, Baby, Church, CloudSun, ShoppingCart,
  BookOpen, GraduationCap, Star, Wifi, Clock, Smile, Utensils, Landmark,
  Car, Briefcase, Leaf, Scale, Plane, Heart, Tv,
} from "lucide-react";

export default function CategoryIcon({
  name,
  className = "w-4 h-4",
}: {
  name?: string;
  className?: string;
}) {
  const n = (name || "").toLowerCase();
  const props = { className, strokeWidth: 1.8 };
  if (n.includes("movie") || n.includes("film") || n.includes("series") || n.includes("cinema")) return <Film {...props} />;
  if (n.includes("news")) return <Newspaper {...props} />;
  if (n.includes("sport")) return <Trophy {...props} />;
  if (n.includes("music")) return <Music {...props} />;
  if (n.includes("kid") || n.includes("child") || n.includes("baby") || n.includes("animation")) return <Baby {...props} />;
  if (n.includes("religio") || n.includes("church") || n.includes("faith")) return <Church {...props} />;
  if (n.includes("weather")) return <CloudSun {...props} />;
  if (n.includes("shop")) return <ShoppingCart {...props} />;
  if (n.includes("document")) return <BookOpen {...props} />;
  if (n.includes("educ") || n.includes("science") || n.includes("learn")) return <GraduationCap {...props} />;
  if (n.includes("entertain")) return <Star {...props} />;
  if (n.includes("general") || n.includes("public")) return <Wifi {...props} />;
  if (n.includes("classic")) return <Clock {...props} />;
  if (n.includes("comedy")) return <Smile {...props} />;
  if (n.includes("cook") || n.includes("food")) return <Utensils {...props} />;
  if (n.includes("culture")) return <Landmark {...props} />;
  if (n.includes("auto") || n.includes("car")) return <Car {...props} />;
  if (n.includes("business") || n.includes("finance")) return <Briefcase {...props} />;
  if (n.includes("lifestyle") || n.includes("outdoor") || n.includes("relax")) return <Leaf {...props} />;
  if (n.includes("legisl") || n.includes("legal")) return <Scale {...props} />;
  if (n.includes("travel")) return <Plane {...props} />;
  if (n.includes("family")) return <Heart {...props} />;
  return <Tv {...props} />;
}
