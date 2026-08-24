import React from 'react';
import { Download, FileSpreadsheet, FileText, LoaderCircle, X } from 'lucide-react';

interface ExportChoiceModalProps {
  open: boolean;
  title?: string;
  description?: string;
  exporting?: boolean;
  pdfDisabled?: boolean;
  excelDisabled?: boolean;
  onClose: () => void;
  onPdf: () => void;
  onExcel: () => void;
  children?: React.ReactNode;
}

const ExportChoiceModal: React.FC<ExportChoiceModalProps> = ({
  open,
  title = 'Export Report',
  description = 'Choose the format for this report export.',
  exporting = false,
  pdfDisabled = false,
  excelDisabled = false,
  onClose,
  onPdf,
  onExcel,
  children,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-indigo-50 p-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-gray-700 disabled:opacity-60"
            aria-label="Close export dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children ? <div className="border-b border-gray-100 p-6">{children}</div> : null}

        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={onPdf}
            disabled={exporting || pdfDisabled}
            className="flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-rose-100 bg-rose-50 p-4 text-left transition hover:border-rose-200 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm">
              {exporting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
            </span>
            <span>
              <span className="block text-sm font-black text-gray-900">Export as PDF</span>
              <span className="mt-1 block text-xs font-semibold text-gray-500">Professional printable report</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onExcel}
            disabled={exporting || excelDisabled}
            className="flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
              {exporting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
            </span>
            <span>
              <span className="block text-sm font-black text-gray-900">Export as Excel</span>
              <span className="mt-1 block text-xs font-semibold text-gray-500">Formatted workbook with merged headings</span>
            </span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-70"
          >
            Cancel
          </button>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-gray-400">
            <Download className="h-4 w-4" />
            XLSX / PDF
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportChoiceModal;
