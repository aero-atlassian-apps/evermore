# Production Readiness Checklist

Before launching to seniors, ensure all items are checked.

## 🔒 Security
- [ ] **HTTPS Enforced**: Vercel handles this automatically.
- [ ] **Secrets Protected**: No `.env` files committed. `CRON_SECRET` set.
- [ ] **Database SSL**: `?sslmode=require` in connection string.
- [ ] **Role Access**: Verify "Family" users cannot edit "Biographer" sessions.

## 🧠 AI Reliability
- [ ] **Hallucination Check Enable**: Ensure `HallucinationDetector` is active.
- [ ] **Rate Limits**: Check usage quotas on Google Vertex and ElevenLabs to avoid hard stops.
- [ ] **Fallbacks**: Validate SVG placeholders appear if Image Gen fails.

## ⚙️ Performance
- [ ] **Database Indexing**: Drizzle schemas should have appropriate indexes.
- [ ] **Redis Caching**: Ensure `REDIS_URL` is an Upstash/Cloud instance, not local.
- [ ] **Asset Optimization**: Images served via Next/Image.

## 📱 User Experience (Seniors)
- [ ] **Font Sizes**: Large text defaults verified.
- [ ] **Contrast**: High contrast ratios (WCAG AAA) on core text.
- [ ] **Voice Latency**: Should be <2s response time.
- [ ] **Error States**: No "JSON errors" visible to user. Natural language error messages.

## 📋 Compliance / Legal
- [ ] **Data Export**: Users can download their PDF storybook.
- [ ] **Privacy Policy**: Link accessible in footer.
