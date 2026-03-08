import { Upload } from 'lucide-react';
import { motion } from 'motion/react';

export default function HeroSection() {
  return (
    <section className="mb-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden p-8 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-2xl"
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Process New Road Survey</h2>
            <p className="text-blue-100/80 max-w-lg">
              Initiate automated defect detection using YOLOv8. Supports high-res dashcam video and synchronized GPS log files.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-6 py-3 bg-white text-blue-700 font-bold rounded-xl shadow-lg hover:bg-blue-50 transition-colors flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Video + GPS
            </button>
            <button className="px-6 py-3 bg-blue-500/30 border border-blue-400/30 text-white font-semibold rounded-xl hover:bg-blue-500/40 transition-colors">
              View Processing Jobs
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
