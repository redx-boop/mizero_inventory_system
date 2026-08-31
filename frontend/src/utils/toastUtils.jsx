import toast from 'react-hot-toast';

/**
 * Show a success toast with an optional undo action.
 * @param {string} message - Success message
 * @param {function} onUndo - Function to call if undo is clicked
 * @param {number} duration - Toast duration in ms (default: 5000)
 */
export const toastSuccess = (message, onUndo, duration = 5000) => {
 toast(
 (t) => (
 <div className="flex items-center gap-3">
 <span className="text-sm">{message}</span>
 {onUndo && (
 <button
 onClick={() => {
 onUndo();
 toast.dismiss(t.id);
 }}
 className="ml-2 text-sm font-semibold text-blue-600 hover:text-blue-800 :text-blue-300"
 >
 Undo
 </button>
 )}
 </div>
 ),
 { duration }
 );
};

/**
 * Show an error toast.
 * @param {string} message - Error message
 */
export const toastError = (message) => {
 toast.error(message, { duration: 4000 });
};

/**
 * Show a loading toast that resolves to success/error.
 * @param {Promise} promise - The async operation
 * @param {object} messages - { loading, success, error }
 * @returns {Promise} The original promise result
 */
export const toastPromise = (promise, { loading, success, error }) => {
 return toast.promise(
 promise,
 {
 loading: <span className="text-sm">{loading}</span>,
 success: <span className="text-sm">{success}</span>,
 error: <span className="text-sm">{error}</span>,
 },
 { duration: 4000 }
 );
};

export { toast };
