"""PDF 분할기 - CustomTkinter GUI 앱"""

import os
import threading
from tkinter import filedialog, messagebox

import customtkinter as ctk
from PyPDF2 import PdfReader, PdfWriter


class PDFSplitterApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("PDF 분할기")
        self.geometry("600x520")
        self.resizable(False, False)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.pdf_path = None
        self.total_pages = 0

        self._build_ui()

    def _build_ui(self):
        # --- 파일 선택 ---
        file_frame = ctk.CTkFrame(self)
        file_frame.pack(fill="x", padx=20, pady=(20, 10))

        self.file_btn = ctk.CTkButton(
            file_frame, text="PDF 파일 선택", width=140, command=self._select_file
        )
        self.file_btn.pack(side="left", padx=(10, 10), pady=10)

        self.file_label = ctk.CTkLabel(
            file_frame, text="파일을 선택해주세요", anchor="w"
        )
        self.file_label.pack(side="left", fill="x", expand=True, padx=(0, 10))

        # --- 분할 방식 선택 ---
        mode_frame = ctk.CTkFrame(self)
        mode_frame.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(mode_frame, text="분할 방식:", font=("", 14, "bold")).pack(
            anchor="w", padx=10, pady=(10, 5)
        )

        self.mode_var = ctk.StringVar(value="range")

        modes = [
            ("range", "페이지 범위 분할  (예: 1-5, 6-10, 11-25)"),
            ("every_n", "N페이지씩 균등 분할"),
            ("extract", "개별 페이지 추출  (예: 3, 7, 15)"),
        ]
        for value, text in modes:
            ctk.CTkRadioButton(
                mode_frame,
                text=text,
                variable=self.mode_var,
                value=value,
                command=self._on_mode_change,
            ).pack(anchor="w", padx=20, pady=3)

        # --- N페이지 입력 (균등 분할용) ---
        self.n_frame = ctk.CTkFrame(mode_frame)

        ctk.CTkLabel(self.n_frame, text="페이지 수:").pack(side="left", padx=(20, 5))
        self.n_entry = ctk.CTkEntry(self.n_frame, width=80, placeholder_text="5")
        self.n_entry.pack(side="left")
        ctk.CTkLabel(self.n_frame, text="페이지씩").pack(side="left", padx=5)

        # --- 범위/페이지 입력란 ---
        self.input_frame = ctk.CTkFrame(mode_frame)
        self.input_frame.pack(fill="x", padx=10, pady=(5, 10))

        self.input_label = ctk.CTkLabel(
            self.input_frame, text="페이지 범위:", anchor="w"
        )
        self.input_label.pack(anchor="w", padx=10, pady=(5, 0))

        self.input_entry = ctk.CTkEntry(
            self.input_frame, placeholder_text="예: 1-5, 6-10, 11-25"
        )
        self.input_entry.pack(fill="x", padx=10, pady=(0, 10))

        self._on_mode_change()

        # --- 저장 폴더 ---
        save_frame = ctk.CTkFrame(self)
        save_frame.pack(fill="x", padx=20, pady=5)

        self.save_btn = ctk.CTkButton(
            save_frame, text="저장 폴더 선택", width=140, command=self._select_output
        )
        self.save_btn.pack(side="left", padx=(10, 10), pady=10)

        self.save_label = ctk.CTkLabel(save_frame, text="(원본 파일과 같은 폴더)", anchor="w")
        self.save_label.pack(side="left", fill="x", expand=True, padx=(0, 10))

        self.output_dir = None

        # --- 진행바 + 실행 ---
        bottom_frame = ctk.CTkFrame(self)
        bottom_frame.pack(fill="x", padx=20, pady=(10, 20))

        self.progress = ctk.CTkProgressBar(bottom_frame)
        self.progress.pack(fill="x", padx=10, pady=(10, 5))
        self.progress.set(0)

        self.status_label = ctk.CTkLabel(bottom_frame, text="대기 중")
        self.status_label.pack(anchor="w", padx=10)

        self.run_btn = ctk.CTkButton(
            bottom_frame,
            text="분할 실행",
            font=("", 15, "bold"),
            height=40,
            command=self._run_split,
        )
        self.run_btn.pack(fill="x", padx=10, pady=(5, 10))

    # --- UI 이벤트 ---

    def _select_file(self):
        path = filedialog.askopenfilename(
            title="PDF 파일 선택",
            filetypes=[("PDF 파일", "*.pdf")],
        )
        if not path:
            return

        try:
            reader = PdfReader(path)
            self.total_pages = len(reader.pages)
        except Exception as e:
            messagebox.showerror("오류", f"PDF를 읽을 수 없습니다:\n{e}")
            return

        self.pdf_path = path
        name = os.path.basename(path)
        self.file_label.configure(text=f"{name}  (총 {self.total_pages}페이지)")

    def _select_output(self):
        path = filedialog.askdirectory(title="저장 폴더 선택")
        if path:
            self.output_dir = path
            self.save_label.configure(text=path)

    def _on_mode_change(self):
        mode = self.mode_var.get()
        if mode == "every_n":
            self.n_frame.pack(fill="x", padx=10, pady=(5, 0))
            self.input_frame.pack_forget()
        elif mode == "range":
            self.n_frame.pack_forget()
            self.input_frame.pack(fill="x", padx=10, pady=(5, 10))
            self.input_label.configure(text="페이지 범위:")
            self.input_entry.configure(placeholder_text="예: 1-5, 6-10, 11-25")
            self.input_entry.delete(0, "end")
        elif mode == "extract":
            self.n_frame.pack_forget()
            self.input_frame.pack(fill="x", padx=10, pady=(5, 10))
            self.input_label.configure(text="추출할 페이지:")
            self.input_entry.configure(placeholder_text="예: 3, 7, 15")
            self.input_entry.delete(0, "end")

    # --- 분할 로직 ---

    def _run_split(self):
        if not self.pdf_path:
            messagebox.showwarning("알림", "PDF 파일을 먼저 선택해주세요.")
            return

        mode = self.mode_var.get()

        try:
            if mode == "range":
                tasks = self._parse_ranges(self.input_entry.get())
            elif mode == "every_n":
                tasks = self._parse_every_n(self.n_entry.get())
            elif mode == "extract":
                tasks = self._parse_extract(self.input_entry.get())
            else:
                return
        except ValueError as e:
            messagebox.showerror("입력 오류", str(e))
            return

        output_dir = self.output_dir or os.path.dirname(self.pdf_path)
        base_name = os.path.splitext(os.path.basename(self.pdf_path))[0]

        self.run_btn.configure(state="disabled")
        self.progress.set(0)

        def work():
            try:
                reader = PdfReader(self.pdf_path)
                total_tasks = len(tasks)

                for i, (pages, suffix) in enumerate(tasks):
                    writer = PdfWriter()
                    for p in pages:
                        writer.add_page(reader.pages[p])

                    out_path = os.path.join(output_dir, f"{base_name}_{suffix}.pdf")
                    with open(out_path, "wb") as f:
                        writer.write(f)

                    progress_val = (i + 1) / total_tasks
                    self.after(0, self._update_progress, progress_val, i + 1, total_tasks)

                self.after(0, self._on_done, total_tasks, output_dir)
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("오류", f"분할 중 오류 발생:\n{e}"))
                self.after(0, lambda: self.run_btn.configure(state="normal"))

        threading.Thread(target=work, daemon=True).start()

    def _update_progress(self, val, current, total):
        self.progress.set(val)
        self.status_label.configure(text=f"진행 중... {current}/{total}")

    def _on_done(self, count, output_dir):
        self.progress.set(1)
        self.status_label.configure(text=f"완료! {count}개 파일 생성됨")
        self.run_btn.configure(state="normal")
        messagebox.showinfo("완료", f"{count}개 파일이 생성되었습니다.\n저장 위치: {output_dir}")

    # --- 파싱 ---

    def _parse_ranges(self, text):
        """'1-5, 6-10, 11-25' → [(pages_list, suffix), ...]"""
        text = text.strip()
        if not text:
            raise ValueError("페이지 범위를 입력해주세요.\n예: 1-5, 6-10, 11-25")

        tasks = []
        for part in text.split(","):
            part = part.strip()
            if "-" not in part:
                raise ValueError(f"잘못된 범위 형식: '{part}'\n하이픈(-)으로 시작-끝을 지정해주세요.")
            start_s, end_s = part.split("-", 1)
            start, end = int(start_s.strip()), int(end_s.strip())

            if start < 1 or end > self.total_pages or start > end:
                raise ValueError(
                    f"범위 오류: {start}-{end}\n"
                    f"1~{self.total_pages} 사이여야 합니다."
                )

            pages = list(range(start - 1, end))  # 0-indexed
            tasks.append((pages, f"{start}-{end}"))

        return tasks

    def _parse_every_n(self, text):
        """N페이지씩 균등 분할"""
        text = text.strip()
        if not text:
            raise ValueError("페이지 수를 입력해주세요.")

        n = int(text)
        if n < 1:
            raise ValueError("1 이상의 숫자를 입력해주세요.")

        tasks = []
        for start in range(0, self.total_pages, n):
            end = min(start + n, self.total_pages)
            pages = list(range(start, end))
            tasks.append((pages, f"{start + 1}-{end}"))

        return tasks

    def _parse_extract(self, text):
        """'3, 7, 15' → 해당 페이지만 추출하여 1개 파일"""
        text = text.strip()
        if not text:
            raise ValueError("추출할 페이지 번호를 입력해주세요.\n예: 3, 7, 15")

        pages = []
        for part in text.split(","):
            p = int(part.strip())
            if p < 1 or p > self.total_pages:
                raise ValueError(
                    f"페이지 오류: {p}\n1~{self.total_pages} 사이여야 합니다."
                )
            pages.append(p - 1)  # 0-indexed

        suffix = "p" + "_".join(str(p + 1) for p in pages)
        return [(pages, suffix)]


if __name__ == "__main__":
    app = PDFSplitterApp()
    app.mainloop()
