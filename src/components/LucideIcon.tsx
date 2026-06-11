import React from "react";
import * as Lucide from "lucide-react";

interface LucideIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function LucideIcon({ name, ...props }: LucideIconProps) {
  // Map our data string names to Lucide elements
  switch (name.toLowerCase()) {
    case "home":
      return <Lucide.Home {...props} />;
    case "shopping_cart":
    case "shopping_basket":
      return <Lucide.ShoppingCart {...props} />;
    case "construction":
    case "wrench":
      return <Lucide.Wrench {...props} />;
    case "favorite":
    case "heart":
      return <Lucide.Heart {...props} />;
    case "book":
    case "bookopen":
    case "menu_book":
    case "article":
      return <Lucide.BookOpen {...props} />;
    case "restaurant":
    case "utensils":
      return <Lucide.Utensils {...props} />;
    case "fitness_center":
    case "dumbbell":
      return <Lucide.Dumbbell {...props} />;
    case "flight":
    case "plane":
      return <Lucide.Plane {...props} />;
    case "settings":
      return <Lucide.Settings {...props} />;
    case "person":
    case "user":
      return <Lucide.User {...props} />;
    case "person-add":
    case "user-plus":
      return <Lucide.UserPlus {...props} />;
    case "arrow_back":
    case "arrowleft":
      return <Lucide.ArrowLeft {...props} />;
    case "add":
    case "plus":
      return <Lucide.Plus {...props} />;
    case "add_circle":
    case "pluscircle":
      return <Lucide.PlusCircle {...props} />;
    case "more_vert":
    case "morevertical":
      return <Lucide.MoreVertical {...props} />;
    case "link":
      return <Lucide.Link {...props} />;
    case "link_off":
    case "linkoff":
      return <Lucide.Link2Off {...props} />;
    case "image":
    case "photo":
      return <Lucide.Image {...props} />;
    case "external_link":
    case "externallink":
      return <Lucide.ExternalLink {...props} />;
    case "close":
    case "x":
      return <Lucide.X {...props} />;
    case "calendar_month":
    case "today":
    case "calendar":
      return <Lucide.Calendar {...props} />;
    case "sunny":
    case "sun":
      return <Lucide.Sun {...props} />;
    case "partly_sunny":
    case "cloudsun":
      return <Lucide.CloudSun {...props} />;
    case "bedtime":
    case "moon":
      return <Lucide.Moon {...props} />;
    case "eco":
    case "leaf":
      return <Lucide.Leaf {...props} />;
    case "water_drop":
    case "droplet":
      return <Lucide.Droplet {...props} />;
    case "inventory":
    case "archive":
      return <Lucide.Archive {...props} />;
    case "receipt":
      return <Lucide.ReceiptText {...props} />;
    case "architecture":
    case "hammer":
      return <Lucide.Hammer {...props} />;
    case "chevron_down":
    case "expand_more":
      return <Lucide.ChevronDown {...props} />;
    case "chevron_right":
    case "chevronright":
      return <Lucide.ChevronRight {...props} />;
    case "search":
      return <Lucide.Search {...props} />;
    case "refresh":
    case "rotateccw":
      return <Lucide.RotateCcw {...props} />;
    case "star":
    case "sparkles":
      return <Lucide.Sparkles {...props} />;
    case "check":
      return <Lucide.Check {...props} />;
    case "edit":
    case "pencil":
      return <Lucide.Pencil {...props} />;
    default:
      return <Lucide.ListTodo {...props} />;
  }
}
