import {
  BookOpen, BookOpenCheck, FileSearch, Network, PenLine, FileText, Heading,
  Palette, PanelsTopLeft, Pipette, ClipboardCheck, ListChecks, CalendarCheck,
  Table2, Mail, ChartNoAxesCombined, ChartPie, Newspaper, Code2, Braces,
  Bug, Link2, Search, CloudSun, Calculator, Plane, Gamepad2, Sparkles,
  Film, MessageCircleQuestion, Megaphone, Target, Users, Lightbulb,
} from '../icons';
import { BookOpenText, Feather, ScanEye, ListTodo, FileCode2, ScanSearch, MapPinned, NotebookPen, Columns3, ListTree, MailOpen, GitCompareArrows, FlaskConical, Calculator as ConversionIcon, Clapperboard, CalendarRange, PackageCheck, Lightbulb as IdeaIcon, Telescope, Newspaper as NewsIcon, Network as KnowledgeIcon, Palette as ColorIcon, TextCursorInput, WandSparkles, MessageCircleQuestion as QuizIcon, UsersRound, ChartPie as ReportIcon, BugPlay, Link as WebLink, CloudSun as WeatherIcon, Gamepad2 as PlayIcon, Sparkles as FireworksIcon, FileText as ExtractIcon, Braces as ApiIcon } from 'lucide-react';

const cardCategories = {
  study:[BookOpenText,'blue'], writing:[Feather,'orange'], design:[ColorIcon,'purple'],
  office:[ListTodo,'green'], business:[Telescope,'orange'], development:[FileCode2,'blue'],
  tools:[ScanSearch,'cyan'], fun:[PlayIcon,'red'], marketing:[IdeaIcon,'yellow'],
};
const cardIllustrations = [
  [/论文|财报/,BookOpenText], [/概念|竞品/,Columns3], [/知识/,KnowledgeIcon],
  [/速递|简报|动态/,NewsIcon], [/标题|故事/,NotebookPen], [/润色/,WandSparkles],
  [/界面|交互文案|设计评审/,ScanEye], [/配色|色彩/,ColorIcon],
  [/回顾|待办|阅读计划|发布计划|周报/,CalendarRange], [/表格/,Columns3],
  [/邮件/,MailOpen], [/研究框架|市场/,Telescope], [/复盘/,ReportIcon],
  [/接口/,ApiIcon], [/测试/,FlaskConical], [/错误/,BugPlay], [/链接/,WebLink],
  [/网页结构|目录/,ListTree], [/摘录|文档|长文/,ExtractIcon],
  [/天气/,WeatherIcon], [/换算/,ConversionIcon], [/出行/,PackageCheck], [/旅行/,MapPinned],
  [/烟花/,FireworksIcon], [/电影/,Clapperboard], [/问答/,QuizIcon],
  [/反馈/,UsersRound], [/品牌/,TextCursorInput], [/对照/,GitCompareArrows],
];
export function getSkillCardIllustration(item) {
  const [fallback,hue] = cardCategories[item.category] || [IdeaIcon,'blue'];
  return { Icon:cardIllustrations.find(([pattern]) => pattern.test(item.title))?.[1] || fallback,
    fill:`var(--color-${hue}-4)`, color:`var(--color-${hue}-7)` };
}

// Content-led demo illustrations; saved skills fall back to their category.
const categories = {
  study: [BookOpen, '#397be8'], writing: [PenLine, '#e77852'],
  design: [Palette, '#9364dc'], office: [ClipboardCheck, '#2b9d7b'],
  business: [ChartNoAxesCombined, '#cf8550'], development: [Code2, '#5472d6'],
  tools: [Search, '#279fae'], fun: [Gamepad2, '#d56b9d'],
  marketing: [Megaphone, '#d69a34'],
};
const illustrations = [
  [/论文|财报/, FileSearch], [/知识|概念/, Network], [/阅读计划/, BookOpenCheck],
  [/速递|简报|动态/, Newspaper], [/标题/, Heading], [/摘录|文档|长文/, FileText],
  [/界面|网页结构/, PanelsTopLeft], [/配色|色彩/, Pipette], [/会议|清单|设计评审/, ListChecks],
  [/回顾|待办|发布计划/, CalendarCheck], [/表格/, Table2], [/邮件/, Mail],
  [/研究框架|市场/, ChartNoAxesCombined], [/复盘/, ChartPie], [/接口/, Braces],
  [/测试|错误/, Bug], [/链接/, Link2], [/天气/, CloudSun], [/换算/, Calculator],
  [/旅行|出行/, Plane], [/烟花/, Sparkles], [/电影/, Film], [/问答/, MessageCircleQuestion],
  [/选题|品牌/, Target], [/反馈/, Users],
];
export function getSkillIllustration(item) {
  const [fallback, color] = categories[item.category] || [Lightbulb, '#397be8'];
  return { Icon: illustrations.find(([pattern]) => pattern.test(item.title))?.[1] || fallback, color };
}
