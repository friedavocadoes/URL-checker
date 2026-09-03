import tkinter as tk
from tkinter import ttk, messagebox
import requests
from bs4 import BeautifulSoup
import threading

class URLInspectorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("URL Inspector & Multi-Checker")
        self.root.geometry("1000x700")

        # Top Frame: Input & Options
        input_frame = ttk.LabelFrame(self.root, text=" Target URLs (One per line) ")
        input_frame.pack(fill="x", padx=10, pady=5)

        self.url_text = tk.Text(input_frame, height=4, width=80)
        self.url_text.pack(side="left", fill="x", expand=True, padx=5, pady=5)
        self.url_text.insert("1.0", "https://google.com")

        btn_frame = ttk.Frame(input_frame)
        btn_frame.pack(side="right", fill="y", padx=5, pady=5)

        self.run_btn = ttk.Button(btn_frame, text="Run Inspection", command=self.start_inspection)
        self.run_btn.pack(fill="x", pady=2)

        # Options Frame
        opts_frame = ttk.Frame(self.root)
        opts_frame.pack(fill="x", padx=10, pady=2)

        self.user_agent_var = tk.StringVar(value="Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        ttk.Label(opts_frame, text="User-Agent:").pack(side="left", padx=2)
        ttk.Entry(opts_frame, textvariable=self.user_agent_var, width=50).pack(side="left", padx=5)

        # Bottom Frame: Notebook for Results Tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=5)

    def start_inspection(self):
        urls = [u.strip() for u in self.url_text.get("1.0", tk.END).splitlines() if u.strip()]
        if not urls:
            messagebox.showwarning("Warning", "Please enter at least one URL.")
            return

        # Clear existing tabs
        for tab in self.notebook.tabs():
            self.notebook.forget(tab)

        self.run_btn.config(state="disabled")
        
        # Run in thread to avoid freezing GUI
        threading.Thread(target=self.inspect_urls, args=(urls,), daemon=True).start()

    def inspect_urls(self, urls):
        headers = {"User-Agent": self.user_agent_var.get()}

        for url in urls:
            if not url.startswith(("http://", "https://")):
                url = "https://" + url
            
            tab_data = self.process_single_url(url, headers)
            self.root.after(0, self.create_result_tab, url, tab_data)

        self.root.after(0, lambda: self.run_btn.config(state="normal"))

    def process_single_url(self, url, headers):
        out = []
        try:
            # Replicates curl -siL (follow redirects)
            session = requests.Session()
            res = session.get(url, headers=headers, allow_redirects=True, timeout=10)

            # 1. Redirect Hops & Response Status
            out.append("=== HTTP REDIRECT HOPS & RESPONSE CODES ===")
            if res.history:
                for idx, resp in enumerate(res.history, 1):
                    target = resp.headers.get("Location", "Unknown")
                    out.append(f"Hop {idx}: [{resp.status_code}] {resp.url} -> Redirects to: {target}")
                out.append(f"Final Destination: [{res.status_code}] {res.url}\n")
            else:
                out.append(f"Direct Response: [{res.status_code}] {res.url}\n")

            # 2. Final Response Headers
            out.append("=== FINAL RESPONSE HEADERS ===")
            for k, v in res.headers.items():
                out.append(f"{k}: {v}")
            out.append("\n")

            # 3. hreflang Extraction (Parsing HTML body)
            out.append("=== HREFLANG TAGS FOUND ===")
            soup = BeautifulSoup(res.text, "html.parser")
            hreflangs = soup.find_all("link", rel=lambda x: x and "alternate" in x.lower())
            
            found_hreflang = False
            for tag in hreflangs:
                if tag.has_attr("hreflang"):
                    found_hreflang = True
                    lang = tag.get("hreflang")
                    href = tag.get("href")
                    out.append(f"hreflang='{lang}' -> {href}")
            
            if not found_hreflang:
                out.append("No <link rel=\"alternate\" hreflang=\"...\"> tags detected on this page.")

        except Exception as e:
            out.append(f"ERROR fetching URL: {str(e)}")

        return "\n".join(out)

    def create_result_tab(self, url, content):
        frame = ttk.Frame(self.notebook)
        tab_label = url.replace("https://", "").replace("http://", "")[:25] + "..."
        self.notebook.add(frame, text=tab_label)

        text_area = tk.Text(frame, wrap="none")
        text_area.insert("1.0", content)
        text_area.pack(fill="both", expand=True)

        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=text_area.yview)
        scrollbar.pack(side="right", fill="y")
        text_area.config(yscrollcommand=scrollbar.set)

if __name__ == "__main__":
    root = tk.Tk()
    app = URLInspectorApp(root)
    root.mainloop()