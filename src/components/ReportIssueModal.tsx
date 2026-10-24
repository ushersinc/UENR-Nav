import React, { useState } from 'react';
import { X, Flag, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { CampusLocation, CampusReport } from '../types/campus';
import { submitReport } from '../services/storageService';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLocation: CampusLocation | null;
  onReportSubmitted: (report: CampusReport) => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  targetLocation,
  onReportSubmitted,
}) => {
  const [locationName, setLocationName] = useState(targetLocation?.name || '');
  const [issueType, setIssueType] = useState<CampusReport['issueType']>('wrong_pin');
  const [description, setDescription] = useState('');
  const [reporterRole, setReporterRole] = useState<CampusReport['reporterRole']>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !locationName.trim()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const newReport = await submitReport({
        locationId: targetLocation?.id,
        locationName: locationName.trim(),
        issueType,
        description: description.trim(),
        reporterRole,
      });

      setIsSubmitting(false);
      setIsSuccess(true);
      onReportSubmitted(newReport);

      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmitError(err.message || 'Failed to submit report. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#176B45] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D7F36A] text-[#176B45] flex items-center justify-center font-bold">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg">Report Campus Map Issue</h2>
              <p className="text-xs text-white/80">Help us keep UENR Nav accurate and up-to-date</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#176B45] mx-auto animate-bounce" />
            <h3 className="font-bold text-lg text-slate-800">Report Successfully Submitted!</h3>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Thank you for contributing. The campus administrator and GIS team will review this report
              and update the official map pins.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
            {/* Building / Location Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Campus Location or Building Name *
              </label>
              <input
                type="text"
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. LT Block, GETFund Hostel, Cafeteria"
                className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
              />
            </div>

            {/* Issue Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type of Issue *
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
              >
                <option value="wrong_pin">Incorrect Pin / Coordinate on Map</option>
                <option value="missing_location">Missing Campus Building / Hall</option>
                <option value="wrong_name">Wrong Building Name or Code</option>
                <option value="blocked_path">Blocked Walkway / Construction Hazard</option>
                <option value="incorrect_directions">Incorrect Pedestrian Walking Route</option>
                <option value="other">Other Information</option>
              </select>
            </div>

            {/* Reporter Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                You are reporting as:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'student', label: 'Student' },
                  { id: 'lecturer', label: 'Lecturer' },
                  { id: 'staff', label: 'Staff' },
                  { id: 'visitor', label: 'Visitor' },
                ].map((role) => (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => setReporterRole(role.id as any)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center border transition-all ${
                      reporterRole === role.id
                        ? 'bg-[#176B45] text-white border-[#176B45] shadow-xs'
                        : 'bg-[#F5F7F4] text-slate-700 border-black/5 hover:bg-slate-200/70'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Description *
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what is wrong and what the correct coordinate, landmark, or pathway should be..."
                className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45] text-xs resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim() || !locationName.trim()}
                className="px-4 py-2 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
