"use client";

import {
  Activity, ArrowDownToLine, ArrowRight, Bookmark, Check, CircleAlert,
  Code2, Copy, FileText, Globe2, ImagePlus, LayoutDashboard, LoaderCircle,
  LogIn, LogOut, Menu, MessageSquareText, Moon, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Pencil, Plus, Search, Send, Settings2, Sparkles, Sun, Trash2,
  WandSparkles, X,
} from "lucide-react";
import Image from "next/image";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { isBrowserSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";

type ToolId = "overview" | "chat" | "writing" | "coding" | "documents" | "summarizer" | "translation" | "image" | "research" | "prompts" | "projects" | "pricing" | "settings" | "admin";
type ModeId = Extract<ToolId, "chat" | "writing" | "coding" | "documents" | "summarizer" | "translation" | "research">;
type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
type ProviderId = "gemini" | "openrouter";
type ProviderStatus = { id: ProviderId; label: string; configured: boolean; model: string; freeTier: boolean };
type Conversation = { id: string; title: string; mode: ModeId; messages: Message[]; updatedAt: string; projectId?: string | null };
type Prompt = { id: string; title: string; content: string };
type Project = { id: string; name: string; createdAt: string };
type Source = { title: string; url: string; content: string };
type Status = { gemini: boolean; openrouter: boolean; supabase: boolean; research: boolean; image: boolean; model: string | null; activeProvider: ProviderId; providers: ProviderStatus[]; rateLimit: { requests: number; windowMinutes: number } };
type AdminSummary = {
  users: { id: string; email: string; createdAt: string; disabled: boolean }[];
  usage: { conversations: number; prompts: number; projects: number; requests: number; errors: number };
  recentErrors: { id: number; tool: string; created_at: string }[];
  subscriptions: { id: string; owner_id: string; plan: string; status: string; updated_at: string }[];
  settings: { key: string; value: unknown }[];
};

const navGroups: { title: string; items: { id: ToolId; label: string; icon: typeof MessageSquareText }[] }[] = [
  { title: "Home", items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }] },
  { title: "Workspace", items: [
    { id: "chat", label: "AI Chat", icon: MessageSquareText },
    { id: "writing", label: "AI Writing", icon: WandSparkles },
    { id: "coding", label: "Code assistant", icon: Code2 },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "summarizer", label: "Summarizer", icon: Activity },
    { id: "translation", label: "Translation", icon: Globe2 },
    { id: "image", label: "Image studio", icon: ImagePlus },
    { id: "research", label: "Research", icon: Search },
  ] },
  { title: "Organize", items: [
    { id: "prompts", label: "Prompt library", icon: Bookmark },
    { id: "projects", label: "Projects", icon: LayoutDashboard },
  ] },
  { title: "Account", items: [
    { id: "pricing", label: "Plans", icon: Activity },
    { id: "settings", label: "Settings", icon: Settings2 },
    { id: "admin", label: "Administration", icon: Settings2 },
  ] },
];

const toolInfo: Record<ToolId, { title: string; description: string; mode?: ModeId; placeholder?: string; eyebrow: string }> = {
  overview: { title: "Your work, in one place.", description: "Pick up a recent conversation or start something new.", eyebrow: "Overview" },
  chat: { title: "A clear space to think.", description: "Ask a question, explore an idea, or work through a tricky problem.", mode: "chat", placeholder: "Ask anything. NEXORA is here to help…", eyebrow: "AI Chat" },
  writing: { title: "Find the right words.", description: "Draft, refine, and shape writing for the people you need to reach.", mode: "writing", placeholder: "What would you like to write? Include audience, tone, and format…", eyebrow: "AI Writing" },
  coding: { title: "Build with a second mind.", description: "Generate, explain, debug, or improve code with practical reasoning.", mode: "coding", placeholder: "Describe the code you need, paste an error, or share a snippet…", eyebrow: "Code assistant" },
  documents: { title: "Ask your material.", description: "Attach a text document, then ask a question grounded in its contents.", mode: "documents", placeholder: "Ask a question about the attached text…", eyebrow: "Documents" },
  summarizer: { title: "Keep the signal.", description: "Turn long notes and documents into a useful, faithful summary.", mode: "summarizer", placeholder: "Paste the text you want summarized…", eyebrow: "Summarizer" },
  translation: { title: "Meaning, carried across.", description: "Translate naturally while preserving intent, tone, and formatting.", mode: "translation", placeholder: "Paste text and name the language to translate into…", eyebrow: "Translation" },
  research: { title: "Explore with sources.", description: "Search the web, then synthesize an answer with links you can inspect.", mode: "research", placeholder: "What question should I research?", eyebrow: "Research" },
  image: { title: "Make a visual idea real.", description: "Write a specific prompt and generate an image with your configured model.", placeholder: "Describe the image you want to create…", eyebrow: "Image studio" },
  prompts: { title: "Your best prompts, ready.", description: "Save reusable instructions and bring them into any workspace conversation.", eyebrow: "Prompt library" },
  projects: { title: "Keep related work together.", description: "Create project spaces for ongoing research, writing, and builds.", eyebrow: "Projects" },
  pricing: { title: "Plans that fit your pace.", description: "Usage tiers are shown for planning. Billing is not connected in this workspace.", eyebrow: "Plans" },
  settings: { title: "Your workspace, your rules.", description: "Manage connections, appearance, and account setup.", eyebrow: "Settings" },
  admin: { title: "Platform operations.", description: "Admin tools are available only to explicitly configured administrators.", eyebrow: "Administration" },
};

const samplePrompts = [
  "Help me turn a rough idea into a clear plan.",
  "Explain a difficult concept with a simple example.",
  "Review this draft and make it more direct.",
  "Find the smallest next step to unblock this project.",
];

function modeFor(tool: ToolId) { return toolInfo[tool].mode || null; }
function newId() { return crypto.randomUUID(); }
function shortTitle(content: string) {
  const title = content.replace(/\s+/g, " ").trim();
  return title.length > 42 ? `${title.slice(0, 39)}…` : title || "New conversation";
}
function blankStatus(): Status {
  return { gemini: false, openrouter: false, supabase: false, research: false, image: false, model: null, activeProvider: "gemini", providers: [], rateLimit: { requests: 20, windowMinutes: 10 } };
}
function settingValue(settings: AdminSummary["settings"], key: string, fallback: number) {
  const parsed = Number(settings.find((setting) => setting.key === key)?.value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default function NexoraWorkspace() {
  const [tool, setTool] = useState<ToolId>("chat");
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<Status>(blankStatus);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("gemini");
  const [account, setAccount] = useState<{ id: string; email?: string } | null>(null);
  const [loadedWorkspaceKey, setLoadedWorkspaceKey] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [documentContext, setDocumentContext] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [toast, setToast] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [promptTitle, setPromptTitle] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset" | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [adminState, setAdminState] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminSummary | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [usageLimits, setUsageLimits] = useState({ free: "20", pro: "500", premium: "2500" });
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThread = threads.find((thread) => thread.id === activeId) || null;
  const messages = activeThread?.mode === modeFor(tool) ? activeThread.messages : [];
  const currentInfo = toolInfo[tool];
  const isConversationTool = Boolean(currentInfo.mode);
  const workspaceKey = account?.id || "guest";
  const selectedProviderInfo = status.providers.find((provider) => provider.id === selectedProvider);
  const selectedProviderReady = selectedProviderInfo?.configured || false;

  const loadCloudWorkspace = useEffectEvent(async () => {
    if (!supabaseBrowser) return;
    const [conversationResult, promptResult, projectResult] = await Promise.all([
      supabaseBrowser.from("conversations").select("id,title,mode,messages,updated_at,project_id").order("updated_at", { ascending: false }).limit(50),
      supabaseBrowser.from("saved_prompts").select("id,title,content").order("created_at", { ascending: false }),
      supabaseBrowser.from("projects").select("id,name,created_at").order("created_at", { ascending: false }),
    ]);
    if (!conversationResult.error && conversationResult.data?.length) {
      const cloudThreads = conversationResult.data.map((thread) => ({
        id: thread.id, title: thread.title, mode: thread.mode, messages: thread.messages,
        updatedAt: thread.updated_at, projectId: thread.project_id,
      })) as Conversation[];
      setThreads((current) => mergeThreads(current, cloudThreads));
    }
    if (!promptResult.error && promptResult.data) setPrompts(promptResult.data as Prompt[]);
    if (!projectResult.error && projectResult.data) {
      setProjects(projectResult.data.map((project) => ({ id: project.id, name: project.name, createdAt: project.created_at })));
    }
  });

  useEffect(() => {
    void fetch("/api/status").then((response) => response.json()).then((value: Status) => {
      setStatus(value);
      setSelectedProvider(value.activeProvider);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let current = true;
    void Promise.resolve().then(() => {
      if (!current) return;
      try {
        const legacyKey = workspaceKey === "guest";
        const read = (name: string) => localStorage.getItem(`nexora:${workspaceKey}:${name}`)
          || (legacyKey ? localStorage.getItem(`nexora:${name}`) : null);
        const savedThreads = read("threads");
        const savedPrompts = read("prompts");
        const savedProjects = read("projects");
        setThreads(savedThreads ? JSON.parse(savedThreads) as Conversation[] : []);
        setPrompts(savedPrompts ? JSON.parse(savedPrompts) as Prompt[] : []);
        setProjects(savedProjects ? JSON.parse(savedProjects) as Project[] : []);
        setActiveId(null);
        setLoadedWorkspaceKey(workspaceKey);
      } catch {
        setToast("Saved workspace data could not be loaded. New work will still be available.");
        setThreads([]); setPrompts([]); setProjects([]); setLoadedWorkspaceKey(workspaceKey);
      }
    });
    return () => { current = false; };
  }, [workspaceKey]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (localStorage.getItem("nexora:theme") === "dark") setDarkMode(true);
      setThemeReady(true);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    if (themeReady) localStorage.setItem("nexora:theme", darkMode ? "dark" : "light");
  }, [darkMode, themeReady]);
  useEffect(() => { if (loadedWorkspaceKey === workspaceKey) localStorage.setItem(`nexora:${workspaceKey}:threads`, JSON.stringify(threads)); }, [threads, loadedWorkspaceKey, workspaceKey]);
  useEffect(() => { if (loadedWorkspaceKey === workspaceKey) localStorage.setItem(`nexora:${workspaceKey}:prompts`, JSON.stringify(prompts)); }, [prompts, loadedWorkspaceKey, workspaceKey]);
  useEffect(() => { if (loadedWorkspaceKey === workspaceKey) localStorage.setItem(`nexora:${workspaceKey}:projects`, JSON.stringify(projects)); }, [projects, loadedWorkspaceKey, workspaceKey]);

  useEffect(() => {
    if (!supabaseBrowser) return;
    void supabaseBrowser.auth.getUser().then(({ data }) => {
      if (data.user) setAccount({ id: data.user.id, email: data.user.email });
    });
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAccount(user ? { id: user.id, email: user.email } : null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (account && loadedWorkspaceKey === workspaceKey) void Promise.resolve().then(loadCloudWorkspace);
  }, [account, loadedWorkspaceKey, workspaceKey]);

  useEffect(() => {
    const client = supabaseBrowser;
    if (!account || !client || !threads.length || loadedWorkspaceKey !== workspaceKey) return;
    const timeout = setTimeout(() => {
      void client.from("conversations").upsert(threads.map((thread) => ({
        id: thread.id, title: thread.title, mode: thread.mode, messages: thread.messages, updated_at: thread.updatedAt, project_id: thread.projectId || null,
      })));
    }, 800);
    return () => clearTimeout(timeout);
  }, [threads, account, loadedWorkspaceKey, workspaceKey]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3600);
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [toast]);

  function notify(message: string) { setToast(message); }
  function updateThread(id: string, update: (thread: Conversation) => Conversation) {
    setThreads((current) => current.map((thread) => thread.id === id ? update(thread) : thread));
  }
  function startNewConversation(nextTool: ToolId = tool) {
    abortRef.current?.abort(); setIsStreaming(false); setSources([]); setDraft(""); setTool(nextTool); setActiveId(null); setMobileOpen(false);
  }
  function openTool(nextTool: ToolId) {
    setTool(nextTool); setMobileOpen(false); setSources([]); setImageResult(null);
    if (nextTool === "admin") void checkAdmin();
  }
  async function checkAdmin() {
    setAdminState("Checking administrator access…");
    try {
      const response = await fetch("/api/admin");
      const data = await response.json() as AdminSummary & { error?: string };
      if (!response.ok) { setAdminData(null); setAdminState(data.error || "Access denied."); return; }
      setAdminData(data);
      setUsageLimits({
        free: String(settingValue(data.settings, "usage_limit_free", 20)),
        pro: String(settingValue(data.settings, "usage_limit_pro", 500)),
        premium: String(settingValue(data.settings, "usage_limit_premium", 2500)),
      });
      setAdminState("Administrator access verified.");
    } catch { setAdminState("The admin service could not be reached."); }
  }
  async function performAdminAction(action: Record<string, unknown>) {
    setAdminBusy(true);
    try {
      const response = await fetch("/api/admin", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(action) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The admin action failed.");
      notify("Administrative change saved.");
      await checkAdmin();
    } catch (error) { notify(error instanceof Error ? error.message : "The admin action failed."); }
    finally { setAdminBusy(false); }
  }

  async function sendPrompt(rawPrompt: string, regenerate = false) {
    const mode = modeFor(tool);
    const prompt = rawPrompt.trim();
    if (!mode || !prompt || isStreaming) return;
    if (!selectedProviderReady) {
      return notify(selectedProvider === "openrouter"
        ? "OpenRouter is not configured. Add OPENROUTER_API_KEY to .env.local, then restart."
        : "Gemini is not configured. Add GEMINI_API_KEY to .env.local, then restart.");
    }
    const existing = activeThread?.mode === mode ? activeThread : null;
    const threadId = existing?.id || newId();
    const userMessage: Message = { id: newId(), role: "user", content: prompt, createdAt: new Date().toISOString() };
    const assistantMessage: Message = { id: newId(), role: "assistant", content: "", createdAt: new Date().toISOString() };
    const history = existing?.messages || [];
    const prior = regenerate && history.at(-1)?.role === "assistant" ? history.slice(0, -1) : history;
    const apiMessages = regenerate ? prior : [...prior, userMessage];
    const thread: Conversation = {
      id: threadId, title: existing?.title || shortTitle(prompt), mode,
      messages: [...apiMessages, assistantMessage], updatedAt: new Date().toISOString(), projectId: existing?.projectId || selectedProjectId,
    };
    setThreads((current) => existing ? current.map((item) => item.id === threadId ? thread : item) : [thread, ...current]);
    setActiveId(threadId); setDraft(""); setSources([]); setIsStreaming(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, mode, messages: apiMessages.map(({ role, content }) => ({ role, content })), context: mode === "documents" ? documentContext : undefined }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "The request could not be completed.");
      }
      const left = response.headers.get("x-ratelimit-remaining");
      if (left) setRemaining(Number(left));
      if (!response.body) throw new Error("The response stream was empty.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() || "";
        for (const event of events) {
          const line = event.split("\n").find((part) => part.startsWith("data: "));
          if (!line || line === "data: [DONE]") continue;
          const payload = JSON.parse(line.slice(6)) as { text?: string; error?: string; sources?: Source[] };
          if (payload.error) throw new Error(payload.error);
          if (payload.sources) setSources(payload.sources);
          if (payload.text) updateThread(threadId, (current) => ({
            ...current,
            messages: current.messages.map((message) => message.id === assistantMessage.id ? { ...message, content: message.content + payload.text } : message),
            updatedAt: new Date().toISOString(),
          }));
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") notify("Generation stopped.");
      else {
        const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        updateThread(threadId, (current) => ({ ...current, messages: current.messages.map((item) => item.id === assistantMessage.id ? { ...item, content: `I couldn't complete that request. ${message}` } : item) }));
        notify(message);
      }
    } finally { setIsStreaming(false); abortRef.current = null; }
  }

  async function generateImage() {
    const prompt = draft.trim();
    if (prompt.length < 5) return notify("Enter an image prompt with at least 5 characters.");
    setIsGeneratingImage(true); setImageResult(null);
    try {
      const response = await fetch("/api/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await response.json() as { image?: string; error?: string };
      if (!response.ok || !data.image) throw new Error(data.error || "Image generation failed.");
      setImageResult(data.image); setDraft("");
    } catch (error) { notify(error instanceof Error ? error.message : "Image generation failed."); }
    finally { setIsGeneratingImage(false); }
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (tool === "image") return void generateImage();
    if (tool === "prompts") return void savePrompt();
    if (tool === "projects") return void createProject();
    await sendPrompt(draft);
  }
  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); }
  }
  async function loadDocument(file?: File) {
    if (!file) return;
    const allowed = /\.(txt|md|csv)$/i.test(file.name) || ["text/plain", "text/markdown", "text/csv"].includes(file.type);
    if (!allowed) return notify("Supported files are .txt, .md, and .csv documents.");
    if (file.size > 2 * 1024 * 1024) return notify("Files must be 2 MB or smaller.");
    try {
      const contents = await file.text(); setDocumentContext(contents.slice(0, 24000));
      notify(`Added ${file.name}${contents.length > 24000 ? " (first 24,000 characters only)" : ""}.`);
    } catch { notify("This file could not be read as text."); }
  }
  function savePrompt() {
    const title = promptTitle.trim(); const content = promptContent.trim();
    if (!title || !content) return notify("Add a title and prompt text before saving.");
    const prompt = { id: newId(), title, content };
    setPrompts((current) => [prompt, ...current]); setPromptTitle(""); setPromptContent("");
    if (account && supabaseBrowser) void supabaseBrowser.from("saved_prompts").upsert(prompt);
    notify("Prompt saved to this workspace.");
  }
  function createProject() {
    const name = projectName.trim();
    if (!name) return notify("Enter a name for this project.");
    const project = { id: newId(), name, createdAt: new Date().toISOString() };
    setProjects((current) => [project, ...current]); setProjectName("");
    if (account && supabaseBrowser) void supabaseBrowser.from("projects").upsert({ id: project.id, name: project.name });
    notify("Project created.");
  }
  async function deletePrompt(prompt: Prompt) {
    setPrompts((current) => current.filter((item) => item.id !== prompt.id));
    if (account && supabaseBrowser) await supabaseBrowser.from("saved_prompts").delete().eq("id", prompt.id);
  }
  function fillComposerWithPrompt(prompt: Prompt) {
    setTool("chat"); setDraft(prompt.content); requestAnimationFrame(() => textareaRef.current?.focus());
  }
  async function authSubmit(event: FormEvent) {
    event.preventDefault(); if (!supabaseBrowser) return;
    setAuthBusy(true); setAuthError("");
    try {
      const result = authMode === "reset"
        ? await supabaseBrowser.auth.resetPasswordForEmail(authEmail, { redirectTo: `${window.location.origin}/auth/reset-password` })
        : authMode === "signup"
          ? await supabaseBrowser.auth.signUp({ email: authEmail, password: authPassword })
          : await supabaseBrowser.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (result.error) setAuthError(result.error.message);
      else {
        setAuthMode(null); setAuthPassword("");
        notify(authMode === "reset" ? "Password reset instructions sent if that email has an account." : authMode === "signup" ? "Account created. Check Supabase email verification settings." : "Signed in.");
      }
    } catch { setAuthError("The account provider could not be reached. Try again."); }
    finally { setAuthBusy(false); }
  }
  async function logout() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    setAccount(null); notify("Signed out.");
  }
  function selectThread(thread: Conversation) {
    setActiveId(thread.id); setTool(thread.mode); setSelectedProjectId(thread.projectId || null); setMobileOpen(false); setSources([]);
  }
  async function copyText(content: string) {
    try { await navigator.clipboard.writeText(content); notify("Copied to clipboard."); }
    catch { notify("Clipboard access was blocked by the browser."); }
  }
  function exportThread(thread: Conversation) {
    const text = `# ${thread.title}\n\n${thread.messages.map((message) => `## ${message.role === "user" ? "You" : "NEXORA"}\n\n${message.content}`).join("\n\n")}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `${thread.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "nexora-conversation"}.md`;
    link.click(); URL.revokeObjectURL(url);
  }
  function editLastPrompt() {
    const last = [...messages].reverse().find((message) => message.role === "user");
    if (last) { setDraft(last.content); requestAnimationFrame(() => textareaRef.current?.focus()); }
  }
  function regenerate() {
    const last = [...messages].reverse().find((message) => message.role === "user");
    if (last) void sendPrompt(last.content, true);
  }
  const recentThreads = threads.filter((thread) => thread.title.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 8);

  return <div className="workspace-shell">
    <button className={`mobile-scrim ${mobileOpen ? "visible" : ""}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
    <aside className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="brand-row"><div className="brand-lockup"><div className="brand-mark"><Sparkles size={19} /></div><div><div className="brand-name">NEXORA</div><div className="brand-subtitle">AI workspace</div></div></div><button className="icon-button" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <button className="new-chat-button" onClick={() => startNewConversation("chat")} title="Start a new conversation"><Plus size={16} /><span className="nav-label">New conversation</span></button>
      <div className="nav-groups">{navGroups.map((group) => <div key={group.title}><div className="nav-section-title">{group.title}</div><nav className="nav-list" aria-label={group.title}>{group.items.map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-button ${tool === item.id ? "active" : ""}`} onClick={() => openTool(item.id)} title={item.label}><Icon className="nav-icon" size={17} /><span className="nav-label">{item.label}</span></button>; })}</nav></div>)}</div>
      <div className="sidebar-spacer" /><div><div className="nav-section-title">Recent</div><div className="recent-list">{recentThreads.length ? recentThreads.map((thread) => <button key={thread.id} className={`recent-thread ${activeId === thread.id ? "active" : ""}`} onClick={() => selectThread(thread)} title={thread.title}><MessageSquareText size={14} /><span>{thread.title}</span></button>) : <div className="recent-thread">No conversations yet</div>}</div></div>
      <div className="sidebar-footer"><div className="avatar">{account?.email?.slice(0, 1).toUpperCase() || "N"}</div><div className="sidebar-footer-copy"><strong>{account?.email || "Guest workspace"}</strong><span>{account ? "Synced account" : "Saved on this device"}</span></div><button className="icon-button" aria-label={account ? "Sign out" : "Sign in"} title={account ? "Sign out" : "Sign in"} onClick={() => account ? void logout() : (setAuthMode("signin"), setAuthError(""))}>{account ? <LogOut size={15} /> : <LogIn size={15} />}</button></div>
    </aside>

    <main className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></button><div className="breadcrumb"><span>Workspace</span><ArrowRight size={13} /><strong>{currentInfo.eyebrow}</strong></div></div><div className="topbar-actions"><label className="topbar-search"><Search size={14} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} aria-label="Search conversations" placeholder="Search conversations" /></label><select className="select-input provider-select" aria-label="AI provider" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value as ProviderId)}><option value="gemini">Gemini</option><option value="openrouter">OpenRouter free</option></select><div className="connection-pill" title={selectedProviderReady ? `${selectedProviderInfo?.label}: ${selectedProviderInfo?.model}` : `${selectedProviderInfo?.label || "AI provider"} needs configuration`}><span className={`connection-dot ${selectedProviderReady ? "ready" : ""}`} /><span>{selectedProviderReady ? `${selectedProviderInfo?.label} ready` : "Setup needed"}</span></div><button className="icon-button" title={darkMode ? "Switch to light mode" : "Switch to dark mode"} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
      <div className="content-area">
        <div className="content-heading"><div><div className="eyebrow"><Sparkles size={13} />{currentInfo.eyebrow}</div><h1 className="page-title">{tool === "chat" && activeThread ? activeThread.title : currentInfo.title}</h1><p className="page-description">{currentInfo.description}</p></div>{isConversationTool && activeThread && <button className="soft-button" onClick={() => exportThread(activeThread)}><ArrowDownToLine size={14} /> Export</button>}</div>
        {tool === "overview" && <>
          <div className="tool-grid dashboard-metrics">{[{ label: "Conversations", value: threads.length }, { label: "Projects", value: projects.length }, { label: "Saved prompts", value: prompts.length }, { label: "AI connection", value: selectedProviderReady ? "Ready" : "Setup needed" }].map((metric) => <div className="surface-panel" key={metric.label}><div className="rail-heading">{metric.label}</div><div className="metric-value">{metric.value}</div></div>)}</div>
          <div className="dashboard-grid"><section className="surface-panel"><div className="panel-heading"><div><h3>Recent projects</h3><p>Continue where you left off.</p></div><button className="quiet-button" onClick={() => openTool("projects")}>All projects <ArrowRight size={13} /></button></div>{projects.length ? projects.slice(0, 5).map((project) => <div className="project-row" key={project.id}><div className="tool-card-icon"><LayoutDashboard size={16} /></div><div className="prompt-row-main"><strong>{project.name}</strong><p>{threads.filter((thread) => thread.projectId === project.id).length} related conversations</p></div><button className="icon-button" title="Open project" aria-label={`Open project ${project.name}`} onClick={() => { setSelectedProjectId(project.id); openTool("chat"); setActiveId(null); }}><ArrowRight size={15} /></button></div>) : <div className="empty-state">Create a project to keep related conversations together.</div>}</section>
          <section className="surface-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Your latest conversation updates.</p></div><Activity size={17} color="var(--green)" /></div>{threads.length ? threads.slice(0, 6).map((thread) => <button className="activity-row" key={thread.id} onClick={() => selectThread(thread)}><span className="activity-mark"><MessageSquareText size={14} /></span><span className="activity-copy"><strong>{thread.title}</strong><small>{toolInfo[thread.mode].eyebrow} · {thread.messages.length} messages</small></span><small>{new Date(thread.updatedAt).toLocaleDateString()}</small></button>) : <div className="empty-state">Your conversations will appear here.</div>}</section></div>
          <div className="section-heading"><div><h2>Open a workspace</h2><p>Choose a focused tool for the work ahead.</p></div></div><div className="tool-grid">{navGroups[1].items.map((item) => { const Icon = item.icon; return <button className="tool-card" key={item.id} onClick={() => openTool(item.id)}><span className="tool-card-icon"><Icon size={17} /></span><h3>{item.label}</h3><p>{toolInfo[item.id].description}</p></button>; })}</div>
        </>}
        {!selectedProviderReady && ["chat", "writing", "coding", "documents", "summarizer", "translation", "research"].includes(tool) && <div className="setup-banner"><CircleAlert size={17} /><div><strong>Connect {selectedProviderInfo?.label || "an AI provider"} to start generating</strong><p>{selectedProvider === "openrouter" ? `The free-model router ${selectedProviderInfo?.model || "openrouter/free"} is selected. Add OPENROUTER_API_KEY to .env.local. OpenRouter currently limits free models to 50 requests/day without purchased credits.` : `The free-tier model ${selectedProviderInfo?.model || "gemini-3.8-flash"} is selected. Add GEMINI_API_KEY to .env.local.`} Keep API keys server-side, then restart the app.</p></div><a className="soft-button" href={selectedProvider === "openrouter" ? "https://openrouter.ai/settings/keys" : "https://aistudio.google.com/apikey"} target="_blank" rel="noreferrer">Get API key <ArrowRight size={13} /></a><button className="quiet-button" onClick={() => openTool("settings")}>Setup</button></div>}
        {tool === "research" && !status.research && <div className="setup-banner"><CircleAlert size={17} /><div><strong>Web search is not configured</strong><p>Research requires TAVILY_API_KEY. Results will not be simulated.</p></div></div>}
        {tool === "image" && !status.image && <div className="setup-banner"><CircleAlert size={17} /><div><strong>Image generation is not configured</strong><p>Add GEMINI_API_KEY and a supported GEMINI_IMAGE_MODEL to enable this tool.</p></div></div>}

        {isConversationTool && <div className="chat-layout"><section className="chat-main" aria-label={`${currentInfo.eyebrow} conversation`}>
          <div className="chat-transcript" aria-live="polite">{!messages.length && <div className="welcome-panel"><div className="welcome-icon"><Sparkles size={23} /></div><h2>{tool === "chat" ? "What are we thinking through?" : currentInfo.title}</h2><p>{tool === "chat" ? "A good question is a great place to begin. Choose a starting point or write your own." : currentInfo.description}</p><div className="starter-grid">{(tool === "chat" ? samplePrompts : ["Give me a concise first draft.", "Ask me one clarifying question before you begin.", "Show the result in a practical, ready-to-use format.", "Explain the important choices as you work."]).map((prompt, index) => <button className="starter-card" key={prompt} onClick={() => setDraft(prompt)}>{index === 0 ? <Sparkles size={15} /> : index === 1 ? <MessageSquareText size={15} /> : index === 2 ? <WandSparkles size={15} /> : <ArrowRight size={15} />}{prompt}</button>)}</div></div>}
            {messages.map((message, index) => <div className="message-row" key={message.id}><div className={`message-avatar ${message.role === "assistant" ? "assistant" : ""}`}>{message.role === "assistant" ? <Sparkles size={14} /> : <span>{account?.email?.slice(0, 1).toUpperCase() || "Y"}</span>}</div><div className="message-content"><div className="message-meta"><strong>{message.role === "assistant" ? "NEXORA" : "You"}</strong><span>{message.role === "assistant" ? "Response" : "Message"}</span></div>{message.content ? <div className={`message-text ${message.role === "user" ? "user-message" : ""}`}>{message.content}</div> : <div className="typing-dots"><span /><span /><span /></div>}{message.role === "assistant" && message.content && <div className="message-actions"><button className="icon-button" title="Copy response" aria-label="Copy response" onClick={() => void copyText(message.content)}><Copy size={14} /></button>{index === messages.length - 1 && <><button className="icon-button" title="Regenerate response" aria-label="Regenerate response" disabled={isStreaming} onClick={regenerate}><MoreHorizontal size={15} /></button><button className="icon-button" title="Edit last prompt" aria-label="Edit last prompt" onClick={editLastPrompt}><Pencil size={13} /></button>{activeThread && <button className="icon-button" title="Export conversation" aria-label="Export conversation" onClick={() => exportThread(activeThread)}><ArrowDownToLine size={14} /></button>}</>}</div>}</div></div>)}
          </div>
          {sources.length > 0 && <div className="source-list"><div className="rail-heading">Research sources</div>{sources.map((source) => <a className="source-link" key={source.url} href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong><span>{source.url}</span></a>)}</div>}
          <form className="composer-wrap" onSubmit={(event) => void submit(event)}>{tool === "documents" && <div className="composer-tools" style={{ marginBottom: 8 }}><label className="soft-button" style={{ cursor: "pointer" }}><Plus size={14} />{documentContext ? "Text attached" : "Attach text file"}<input type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" hidden onChange={(event) => void loadDocument(event.target.files?.[0])} /></label>{documentContext && <button type="button" className="quiet-button" onClick={() => setDocumentContext("")}>Remove file <X size={13} /></button>}</div>}<div className="composer"><textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} placeholder={currentInfo.placeholder} aria-label={`${currentInfo.eyebrow} message`} disabled={isStreaming} /><div className="composer-footer"><div className="composer-tools"><span className="composer-hint">Enter to send · Shift + Enter for a new line</span>{projects.length > 0 && <select className="select-input" style={{ width: "auto", height: 28, fontSize: 10 }} aria-label="Add conversation to project" value={selectedProjectId || ""} onChange={(event) => setSelectedProjectId(event.target.value || null)}><option value="">No project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select>}{tool === "documents" && documentContext && <span className="composer-hint">{documentContext.length.toLocaleString()} characters ready</span>}</div><div className="composer-send">{isStreaming && <button type="button" className="quiet-button" onClick={() => abortRef.current?.abort()}>Stop</button>}<button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || isStreaming}><Send size={16} /></button></div></div></div></form>
        </section><aside className="chat-rail"><div className="rail-section"><div className="rail-heading">Workspace status</div><div className="capability-item"><Check size={13} /> Private on this device</div><div className="capability-item">{selectedProviderReady ? <Check size={13} /> : <CircleAlert size={13} />}{selectedProviderReady ? `Using ${selectedProviderInfo?.label}: ${selectedProviderInfo?.model}` : `${selectedProviderInfo?.label || "AI provider"} setup required`}</div><div className="usage-track"><span style={{ width: `${remaining === null ? 8 : Math.max(4, ((20 - remaining) / 20) * 100)}%` }} /></div><div className="usage-caption">{remaining === null ? `${status.rateLimit.requests} requests per ${status.rateLimit.windowMinutes} min process window` : `${remaining} requests left in this window`}</div></div><div className="rail-section"><div className="rail-heading">Try a direction</div>{samplePrompts.slice(0, 3).map((prompt) => <button className="rail-starter" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div></aside></div>}

        {tool === "image" && <div className="surface-panel"><div className="panel-heading"><div><h3>Image prompt</h3><p>The configured model will return an actual generated image.</p></div><ImagePlus size={19} color="var(--green)" /></div><textarea className="large-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={currentInfo.placeholder} aria-label="Image prompt" /><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button className="primary-button" onClick={() => void generateImage()} disabled={isGeneratingImage || draft.trim().length < 5}>{isGeneratingImage ? <LoaderCircle className="spin" size={14} /> : <ImagePlus size={14} />}{isGeneratingImage ? "Generating…" : "Generate image"}</button></div>{imageResult && <Image className="image-result" src={imageResult} alt="AI-generated result" width={1024} height={1024} unoptimized />}</div>}

        {tool === "prompts" && <><div className="surface-panel"><div className="panel-heading"><div><h3>Save a prompt</h3><p>Keep a useful instruction close at hand.</p></div><Bookmark size={18} color="var(--green)" /></div><div className="input-row"><label><span className="form-label">Prompt name</span><input className="text-input" value={promptTitle} onChange={(event) => setPromptTitle(event.target.value)} placeholder="e.g. Weekly project update" /></label><label><span className="form-label">Prompt text</span><input className="text-input" value={promptContent} onChange={(event) => setPromptContent(event.target.value)} placeholder="Write a concise update for…" /></label></div><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button className="primary-button" onClick={savePrompt}><Plus size={14} /> Save prompt</button></div></div><div className="surface-panel"><div className="panel-heading"><div><h3>Saved prompts</h3><p>{prompts.length} prompt{prompts.length === 1 ? "" : "s"} in your library</p></div></div>{prompts.length ? prompts.map((prompt) => <div className="prompt-row" key={prompt.id}><div className="prompt-row-main"><strong>{prompt.title}</strong><p>{prompt.content}</p></div><button className="icon-button" title="Use prompt" aria-label={`Use ${prompt.title}`} onClick={() => fillComposerWithPrompt(prompt)}><ArrowRight size={15} /></button><button className="icon-button" title="Delete prompt" aria-label={`Delete ${prompt.title}`} onClick={() => void deletePrompt(prompt)}><Trash2 size={14} /></button></div>) : <div className="empty-state">Your saved prompts will appear here.</div>}</div></>}

        {tool === "projects" && <><div className="surface-panel"><div className="panel-heading"><div><h3>Create a project</h3><p>Group a line of work under one clear name.</p></div><LayoutDashboard size={18} color="var(--green)" /></div><div style={{ display: "flex", gap: 9 }}><input className="text-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createProject(); }} placeholder="Project name" /><button className="primary-button" onClick={createProject}><Plus size={14} /> Create</button></div></div><div className="surface-panel"><div className="panel-heading"><div><h3>Your projects</h3><p>Conversations and outputs stay linked to the selected project.</p></div></div>{projects.length ? projects.map((project) => { const projectThreads = threads.filter((thread) => thread.projectId === project.id); return <div className="project-row" key={project.id}><div className="tool-card-icon"><LayoutDashboard size={16} /></div><div className="prompt-row-main"><strong>{project.name}</strong><p>{projectThreads.length} conversation{projectThreads.length === 1 ? "" : "s"} · Created {new Date(project.createdAt).toLocaleDateString()}</p></div><button className="icon-button" title="Open project conversation" aria-label={`Open project ${project.name}`} onClick={() => { setSelectedProjectId(project.id); setTool("chat"); setActiveId(projectThreads[0]?.id || null); setDraft(projectThreads.length ? "" : `I am working on the project “${project.name}”. Help me with the next step.`); }}><ArrowRight size={15} /></button></div>; }) : <div className="empty-state">No projects yet. Create one to begin organizing your work.</div>}</div></>}

        {tool === "settings" && <><div className="surface-panel"><div className="panel-heading"><div><h3>AI providers</h3><p>Choose a configured provider; secrets stay in the server environment.</p></div><Settings2 size={18} color="var(--green)" /></div><label className="provider-choice"><span className="form-label">Active provider</span><select className="select-input" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value as ProviderId)}><option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter free router</option></select></label><Integration label="Google Gemini" detail={status.gemini ? `Connected with ${status.providers.find((provider) => provider.id === "gemini")?.model}` : `Free-tier model ${status.providers.find((provider) => provider.id === "gemini")?.model || "gemini-3.8-flash"} selected. Add GEMINI_API_KEY.`} ready={status.gemini} href="https://aistudio.google.com/apikey" linkLabel="Get key" /><Integration label="OpenRouter free models" detail={status.openrouter ? `Connected with ${status.providers.find((provider) => provider.id === "openrouter")?.model}` : `Add OPENROUTER_API_KEY. Model defaults to openrouter/free; free models currently allow 50 requests/day without credits.`} ready={status.openrouter} href="https://openrouter.ai/settings/keys" linkLabel="Get key" /><Integration label="Supabase auth & sync" detail={status.supabase ? "Connected. Access depends on row-level security." : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."} ready={status.supabase} /><Integration label="Web research (Tavily)" detail={status.research ? "Configured for sourced search." : "Set TAVILY_API_KEY to enable web search."} ready={status.research} /><Integration label="Image generation" detail={status.image ? "Gemini image model is configured." : "Set GEMINI_IMAGE_MODEL and GEMINI_API_KEY."} ready={status.image} /></div><div className="surface-panel"><div className="panel-heading"><div><h3>Account</h3><p>{account?.email || (status.supabase ? "Sign in to sync your private workspace." : "This workspace currently saves to this browser only.")}</p></div></div>{status.supabase ? account ? <button className="soft-button" onClick={() => void logout()}><LogOut size={14} /> Sign out</button> : <button className="primary-button" onClick={() => setAuthMode("signin")}><LogIn size={14} /> Sign in or create account</button> : <div className="setup-banner" style={{ margin: 0 }}><CircleAlert size={16} /><div><strong>Authentication is not configured</strong><p>Configure Supabase URL and anon key, then apply supabase/schema.sql.</p></div></div>}</div></>}

        {tool === "pricing" && <div className="plan-grid">{[{ name: "Free", price: "$0", features: ["20 requests per 10-minute window", "Core AI tools", "Local workspace history"] }, { name: "Pro", price: "Configurable", features: ["Higher request limits", "Expanded project workflows", "Cloud history when connected"], featured: true }, { name: "Premium", price: "Configurable", features: ["Advanced features", "Priority capacity", "Admin-managed limits"] }].map((plan) => <div className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name}><h3>{plan.name}</h3><div className="plan-price">{plan.price}<span>{plan.price.startsWith("$") ? " / month" : " by deployment"}</span></div><ul>{plan.features.map((feature) => <li key={feature}>• {feature}</li>)}</ul><button className="soft-button" style={{ width: "100%" }} disabled>{plan.name === "Free" ? "Current workspace" : "Billing not configured"}</button></div>)}</div>}

        {tool === "admin" && <>
          <div className="surface-panel"><div className="panel-heading"><div><h3>Administrator access</h3><p>Access is granted by server-side email allowlist, never by user profile.</p></div><Activity size={18} color="var(--green)" /></div><div className="setup-banner" style={{ marginBottom: 0 }}><CircleAlert size={17} /><div><strong>{adminState || "Admin access is checked by the server."}</strong><p>Configure ADMIN_EMAIL_ALLOWLIST, Supabase, and SUPABASE_SERVICE_ROLE_KEY to enable these controls.</p></div></div><button className="soft-button" style={{ marginTop: 12 }} disabled={adminBusy} onClick={() => void checkAdmin()}>{adminBusy && <LoaderCircle className="spin" size={14} />}Refresh admin data</button></div>
          {adminData && <>
            <div className="tool-grid" style={{ marginTop: 14 }}>{[{ label: "Accounts", value: adminData.users.length }, { label: "Conversations", value: adminData.usage.conversations }, { label: "AI requests", value: adminData.usage.requests }, { label: "Recorded errors", value: adminData.usage.errors }].map((metric) => <div className="surface-panel" key={metric.label}><div className="rail-heading">{metric.label}</div><div className="metric-value">{metric.value}</div></div>)}</div>
            <div className="surface-panel" style={{ marginTop: 14 }}><div className="panel-heading"><div><h3>Accounts</h3><p>First 50 accounts returned from Supabase Auth.</p></div></div>{adminData.users.map((user) => <div className="project-row" key={user.id}><div className="prompt-row-main"><strong>{user.email}</strong><p>Created {new Date(user.createdAt).toLocaleDateString()}</p></div><span className={`status-badge ${user.disabled ? "" : "ready"}`}>{user.disabled ? "Suspended" : "Active"}</span><button className="soft-button" disabled={adminBusy} onClick={() => void performAdminAction({ action: "user_status", userId: user.id, disabled: !user.disabled })}>{user.disabled ? "Restore" : "Suspend"}</button></div>)}</div>
            <div className="surface-panel"><div className="panel-heading"><div><h3>Usage limits</h3><p>Per-plan caps are stored in protected platform settings.</p></div></div><div className="input-row">{(["free", "pro", "premium"] as const).map((plan) => <label key={plan}><span className="form-label">{plan[0].toUpperCase() + plan.slice(1)} requests / window</span><input className="text-input" type="number" min="1" max="100000" value={usageLimits[plan]} onChange={(event) => setUsageLimits((current) => ({ ...current, [plan]: event.target.value }))} /></label>)}</div><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button className="primary-button" disabled={adminBusy} onClick={() => void Promise.all((["free", "pro", "premium"] as const).map((plan) => performAdminAction({ action: "usage_limit", plan, limit: Number(usageLimits[plan]) })))}><Check size={14} />Save limits</button></div></div>
            <div className="surface-panel"><div className="panel-heading"><div><h3>Available tools</h3><p>Disable individual tools for everyone on this deployment.</p></div></div>{(["chat", "writing", "coding", "documents", "summarizer", "translation", "research", "image"] as const).map((toolName) => { const saved = adminData.settings.find((setting) => setting.key === `tool_enabled_${toolName}`)?.value; const checked = saved === undefined ? true : saved === true; return <label className="integration-row" key={toolName}><div><strong>{toolName[0].toUpperCase() + toolName.slice(1)}</strong><p>Requests are enforced by the server.</p></div><input type="checkbox" checked={checked} disabled={adminBusy} onChange={(event) => void performAdminAction({ action: "tool_status", tool: toolName, enabled: event.target.checked })} /></label>; })}</div>
            <div className="surface-panel"><div className="panel-heading"><div><h3>Recent API errors</h3><p>Metadata only. Prompts and credentials are never stored here.</p></div></div>{adminData.recentErrors.length ? adminData.recentErrors.map((error) => <div className="integration-row" key={error.id}><strong>{error.tool}</strong><span className="status-badge">{new Date(error.created_at).toLocaleString()}</span></div>) : <div className="empty-state">No recorded request errors.</div>}</div>
            <div className="surface-panel"><div className="panel-heading"><div><h3>Subscriptions</h3><p>Records must be updated by a verified payment-provider webhook.</p></div></div>{adminData.subscriptions.length ? adminData.subscriptions.map((subscription) => <div className="integration-row" key={subscription.id}><div><strong>{subscription.plan} · {subscription.status}</strong><p>{subscription.owner_id}</p></div><span className="status-badge">{new Date(subscription.updated_at).toLocaleDateString()}</span></div>) : <div className="empty-state">No subscription records. Payment processing is not configured.</div>}</div>
          </>}
        </>}
      </div>
    </main>

    {authMode && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthMode(null); }}><form className="modal" onSubmit={(event) => void authSubmit(event)}><div className="modal-header"><div><h2>{authMode === "signup" ? "Create your account" : authMode === "reset" ? "Reset your password" : "Welcome back"}</h2><p>{isBrowserSupabaseConfigured ? authMode === "reset" ? "We’ll send a secure reset link if the account exists." : "Your account unlocks private cloud sync." : "Supabase must be configured before sign-in is available."}</p></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setAuthMode(null)}><X size={16} /></button></div>{!isBrowserSupabaseConfigured ? <div className="setup-banner" style={{ marginTop: 16, marginBottom: 0 }}><CircleAlert size={16} /><div><strong>Account provider unavailable</strong><p>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.</p></div></div> : <><label><span className="form-label">Email</span><input className="text-input" type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} /></label>{authMode !== "reset" && <label><span className="form-label">Password</span><input className="text-input" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={8} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} /></label>}{authError && <p style={{ color: "var(--accent)", fontSize: 11 }}>{authError}</p>}<div className="modal-actions">{authMode === "signin" ? <button type="button" className="quiet-button" onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Create account</button> : <button type="button" className="quiet-button" onClick={() => { setAuthMode("signin"); setAuthError(""); }}>Back to sign in</button>}{authMode === "signin" && <button type="button" className="quiet-button" onClick={() => { setAuthMode("reset"); setAuthError(""); }}>Forgot password?</button>}<button className="primary-button" disabled={authBusy}>{authBusy && <LoaderCircle className="spin" size={14} />}{authMode === "signup" ? "Sign up" : authMode === "reset" ? "Send reset link" : "Sign in"}</button></div></>}</form></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function Integration({ label, detail, ready, href, linkLabel }: { label: string; detail: string; ready: boolean; href?: string; linkLabel?: string }) {
  return <div className="integration-row"><div><strong>{label}</strong><p>{detail}</p>{href && !ready && <a className="integration-link" href={href} target="_blank" rel="noreferrer">{linkLabel || "Configure"}</a>}</div><span className={`status-badge ${ready ? "ready" : ""}`}><span className={`connection-dot ${ready ? "ready" : ""}`} />{ready ? "Connected" : "Not configured"}</span></div>;
}

function mergeThreads(localThreads: Conversation[], cloudThreads: Conversation[]) {
  const byId = new Map(localThreads.map((thread) => [thread.id, thread]));
  for (const thread of cloudThreads) byId.set(thread.id, { ...thread, mode: thread.mode || "chat" } as Conversation);
  return [...byId.values()].sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
}