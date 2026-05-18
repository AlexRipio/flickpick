import React from 'react';
import { motion } from 'framer-motion';

const WelcomeMessage = () => {
  return (
    <motion.p
      className='text-xl md:text-2xl text-white max-w-2xl mx-auto'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      Hola, soy <span className='font-semibold text-purple-300'>FlickPick</span>, tu app para elegir película sin discutir.
    </motion.p>
  );
};

export default WelcomeMessage;