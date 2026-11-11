import { forwardRef, type ComponentType, type SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: string | number; strokeWidth?: string | number; absoluteStrokeWidth?: boolean };
export type LucideIcon = ComponentType<Props>;

function icon(glyph: string, rotation = 0) {
  return forwardRef<SVGSVGElement, Props>(function LibraryIcon({ size = 24, className, style, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }, ref) {
    return <svg {...props} ref={ref} width={size} height={size} viewBox="0 0 16 16" className={className} style={style} fill="none" aria-hidden="true">
      <foreignObject x="0" y="0" width="16" height="16" style={{ overflow: "visible", transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: "8px 8px" }}>
        <span style={{ display: "grid", placeItems: "center", width: 16, height: 16, fontFamily: "TabbitVoiceLine", fontSize: 16, fontWeight: 400, fontStyle: "normal", lineHeight: "16px", color: "currentColor" }}>{glyph}</span>
      </foreignObject>
    </svg>;
  });
}

export const ArrowDownUp = icon("\ue147", 0);
export const ArrowLeft = icon("\ue011", 180);
export const ArrowLeftRight = icon("\ue14f", 0);
export const ArrowRight = icon("\ue011", 0);
export const ArrowUp = icon("\ue01f", 90);
export const ArrowUpRight = icon("\ue041", 0);
export const Asterisk = icon("\ue0a4", 0);
export const Bell = icon("\ue354", 0);
export const BookOpen = icon("\ue00c", 0);
export const BookOpenCheck = icon("\ue00c", 0);
export const Bookmark = icon("\ue13b", 0);
export const Braces = icon("\ue311", 0);
export const BrushCleaning = icon("\ue477", 0);
export const Bug = icon("\ue530", 0);
export const Calculator = icon("\ue47c", 0);
export const CalendarCheck = icon("\ue04a", 0);
export const AlarmClock = icon("\ue2c5", 0);
export const MessageCirclePlus = icon("\ue092", 0);
export const SidebarDashboard = icon("\ue007", 0);
export const CalendarClock = icon("\ue04a", 0);
export const Cat = icon("\ue045", 0);
export const ChartCandlestick = icon("\ue409", 0);
export const ChartNoAxesCombined = icon("\ue409", 0);
export const ChartPie = icon("\ue40c", 0);
export const Check = icon("\ue042", 0);
export const CheckCheck = icon("\ue042", 0);
export const ChevronDown = icon("\ue00e", 0);
export const ChevronLeft = icon("\ue011", 180);
export const ChevronRight = icon("\ue011", 0);
export const CircleCheck = icon("\ue11f", 0);
export const ClipboardCheck = icon("\ue1e6", 0);
export const ClipboardList = icon("\ue431", 0);
export const Clock3 = icon("\ue00f", 0);
export const Cloud = icon("\ue5c4", 0);
export const CloudSun = icon("\ue5bb", 0);
export const Code2 = icon("\ue311", 0);
export const Cog = icon("\ue009", 0);
export const Controls = icon("\ue013", 0);
export const Copy = icon("\ue01b", 0);
export const CopyPlus = icon("\ue122", 0);
export const CreditCard = icon("\ue027", 0);
export const Download = icon("\ue3fd", 0);
export const Ellipsis = icon("\ue00a", 0);
export const ExternalLink = icon("\ue041", 0);
export const File = icon("\ue407", 0);
export const FileImage = icon("\ue405", 0);
export const FileInput = icon("\ue3ed", 0);
export const FilePlus2 = icon("\ue3f3", 0);
export const FileSearch = icon("\ue3f8", 0);
export const FileSpreadsheet = icon("\ue027", 0);
export const FileText = icon("\ue027", 0);
export const FileType = icon("\ue027", 0);
export const Files = icon("\ue3df", 0);
export const Film = icon("\ue063", 0);
export const Fish = icon("\ue59a", 0);
export const Flag = icon("\ue044", 0);
export const Folder = icon("\ue428", 0);
export const FolderCog = icon("\ue40f", 0);
export const FolderOpen = icon("\ue077", 0);
export const FolderPlus = icon("\ue078", 0);
export const Gamepad2 = icon("\ue057", 0);
export const Gauge = icon("\ue00f", 0);
export const Globe = icon("\ue534", 0);
export const Grid2X2 = icon("\ue0b2", 0);
export const GripVertical = icon("\ue11c", 0);
export const Heading = icon("\ue233", 0);
export const Home = icon("\ue2ef", 0);
export const House = icon("\ue2ef", 0);
export const Image = icon("\ue026", 0);
export const ImagePlus = icon("\ue393", 0);
export const Laptop = icon("\ue39f", 0);
export const Layers = icon("\ue0b2", 0);
export const LayoutDashboard = icon("\ue0b2", 0);
export const LayoutGrid = icon("\ue0b2", 0);
export const Lightbulb = icon("\ue2a8", 0);
export const Link2 = icon("\ue065", 0);
export const List = icon("\ue006", 0);
export const ListChecks = icon("\ue1e6", 0);
export const BatchListChecks = icon("\ue1ea", 0);
export const ListFilter = icon("\ue1ec", 0);
export const Mail = icon("\ue027", 0);
export const Megaphone = icon("\ue354", 0);
export const MessageCircle = icon("\ue015", 0);
export const MessageCircleQuestion = icon("\ue100", 0);
export const MessageCircleReply = icon("\ue09c", 0);
export const MessageSquare = icon("\ue0a3", 0);
export const MessageSquareText = icon("\ue0a3", 0);
export const Mic = icon("\ue36f", 0);
export const Microscope = icon("\ue008", 0);
export const Minus = icon("\ue13f", 0);
export const Monitor = icon("\ue39f", 0);
export { MoveDiagonal2 } from "lucide-react";
export const Network = icon("\ue4d9", 0);
export const Newspaper = icon("\ue40d", 0);
export const Palette = icon("\ue46f", 0);
export const PanelLeftClose = icon("\ue1e8", 0);
export const PanelLeftOpen = icon("\ue1e5", 0);
export const PanelTop = icon("\ue0bc", 0);
export const PanelsTopLeft = icon("\ue0b2", 0);
export const Paperclip = icon("\ue2c3", 0);
export const Pause = icon("\ue3ba", 0);
export const PenLine = icon("\ue299", 0);
export const Pencil = icon("\ue299", 0);
export const Pin = icon("\ue292", 0);
export const PinOff = icon("\ue288", 0);
export const Pipette = icon("\ue486", 0);
export const Plane = icon("\ue537", 0);
export const Play = icon("\ue1ef", 0);
export const Start = icon("\ue018", 0);
export const Plus = icon("\ue033", 0);
export const Presentation = icon("\ue4ad", 0);
export const Quote = icon("\ue5ca", 0);
export const Redo2 = icon("\ue01f", 180);
export const RefreshCw = icon("\ue1aa", 0);
export const Scaling = icon("\ue025", 0);
export const Search = icon("\ue008", 0);
export const Settings2 = icon("\ue009", 0);
export const Share2 = icon("\ue00b", 0);
export const Shield = icon("\ue34c", 0);
export const ShieldCheck = icon("\ue34c", 0);
export const ShieldQuestion = icon("\ue34c", 0);
export const Sparkles = icon("\ue2a8", 0);
export const SquarePen = icon("\ue299", 0);
export const Star = icon("\ue0a4", 0);
export const Table2 = icon("\ue027", 0);
export const Target = icon("\ue292", 0);
export const TextCursorInput = icon("\ue233", 0);
export const Ticket = icon("\ue027", 0);
export const Trash2 = icon("\ue032", 0);
export const TrendingUp = icon("\ue409", 0);
export const Type = icon("\ue233", 0);
export const Undo2 = icon("\ue01f", 0);
export const Upload = icon("\ue3ed", 0);
export const UserRoundSearch = icon("\ue008", 0);
export const Users = icon("\ue460", 0);
export const X = icon("\ue03e", 0);
export const Zap = icon("\ue2a8", 0);

export const OutputTable = icon("\ue21d", 0);
export const OutputDocument = icon("\ue40d", 0);

export const OutputFolder = icon("\ue076", 0);
export const OutputGlobe = icon("\ue524", 0);
export const OutputCollection = icon("\ue0d1", 0);
export const OutputAppWindow = icon("\ue30f", 0);

export const OutputGridView = icon("\ue11e", 0);
export const OutputListView = icon("\ue006", 0);

export const OutputSort = icon("\ue171", 0);

export const OutputDownload = icon("\ue177", 0);

export const OutputShare = icon("\ue075", 0);
