export default { 
  server: { port: 5173, host: true },
  build: {
    minify: 'esbuild', // Используем esbuild вместо terser (встроен в Vite)
    // esbuild не удаляет console.log по умолчанию
  }
};
