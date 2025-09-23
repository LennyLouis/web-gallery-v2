import { useState, useEffect } from 'react';
import { Container, Form, Alert, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import type { Route } from './+types/login';

// Safe hook for handling AuthProvider context issues
const useSafeAuth = () => {
  try {
    return useAuth();
  } catch (error) {
    // If AuthProvider is not available, return default values
    return {
      user: null,
      session: null,
      loading: false,
      isSessionValid: () => false,
      login: async () => ({ success: false, error: 'Authentication not available' }),
      register: async () => ({ success: false, error: 'Authentication not available' }),
      validateAccessLink: async () => ({ success: false, error: 'Authentication not available', album: null }),
      refreshSession: async () => ({ success: false, error: 'Authentication not available' }),
      logout: async () => ({ success: true })
    };
  }
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Les photos de Lenny - Connexion' },
    { name: 'description', content: 'Connectez-vous pour accéder à vos photos' },
  ];
}

export default function Login() {
  const navigate = useNavigate();
  const { user, login, validateAccessLink, loading: authLoading } = useSafeAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'access-link'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    accessToken: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Rediriger si l'utilisateur est déjà connecté
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleTabChange = (tab: 'login' | 'access-link') => {
    setActiveTab(tab);
    setError('');
    setFormData({ email: '', password: '', accessToken: '' });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Email ou mot de passe invalide.');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      // TODO: Intégrer Google Sign-In avec Supabase
      // const { data, error } = await supabase.auth.signInWithProvider({ provider: 'google' });
      setError('Connexion Google non implémentée pour le moment.');
    } catch (err) {
      setError('Erreur lors de la connexion avec Google.');
      console.error('Google Sign-In error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccessLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Extraire le token du lien d'accès si c'est un lien complet
      let token = formData.accessToken.trim();

      // Si c'est un lien complet, extraire le token
      if (token.includes('/album/access/')) {
        token = token.split('/album/access/')[1];
      }

      const result = await validateAccessLink(token);

      if (result.success && result.album) {
        // Stocker le token d'accès de manière sécurisée dans sessionStorage
        // JAMAIS dans l'URL pour des raisons de sécurité
        sessionStorage.setItem('access_token', token);
        sessionStorage.setItem('album_id', result.album.id);

        // Rediriger vers l'album sans exposer le token dans l'URL
        navigate(`/album/${result.album.id}`);
      } else {
        setError(result.error || 'Lien d\'accès invalide ou expiré.');
      }
    } catch (err) {
      setError('Erreur de validation du lien.');
      console.error('Access link error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Container>
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <h1>📸 Les photos de Lenny</h1>
            <p>Accédez à vos photos en toute sécurité</p>
          </div>

          <div className="card-clean">
            <div className="p-4">
              {/* Tab Navigation */}
              <div className="login-tabs">
                <button
                  type="button"
                  className={`login-tab ${activeTab === 'login' ? 'active' : ''}`}
                  onClick={() => handleTabChange('login')}
                >
                  🔑 Connexion
                </button>
                <button
                  type="button"
                  className={`login-tab ${activeTab === 'access-link' ? 'active' : ''}`}
                  onClick={() => handleTabChange('access-link')}
                >
                  🔗 Lien d'accès
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="danger" className="alert-clean">
                  {error}
                </Alert>
              )}

              {/* Login Form */}
              {activeTab === 'login' ? (
                <>
                  {/* Google Sign-In Button */}
                  <button
                    type="button"
                    className="btn-google w-100 mb-3"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continuer avec Google
                      </>
                    )}
                  </button>

                  <div className="divider">
                    <span>ou</span>
                  </div>

                  {/* Email/Password Form */}
                  <Form onSubmit={handleLogin}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label-clean">Adresse email</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="form-control-clean"
                        placeholder="votre@email.com"
                        required
                        disabled={loading}
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label className="form-label-clean">Mot de passe</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="form-control-clean"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                      />
                    </Form.Group>

                    <button
                      type="submit"
                      className="btn-clean-primary w-100 mb-3"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            className="me-2"
                          />
                          Connexion en cours...
                        </>
                      ) : (
                        'Se connecter'
                      )}
                    </button>
                  </Form>
                </>
              ) : (
                /* Access Link Form */
                <Form onSubmit={handleAccessLinkSubmit}>
                  <Form.Group className="mb-4">
                    <Form.Label className="form-label-clean">Lien d'accès ou token</Form.Label>
                    <Form.Control
                      type="text"
                      name="accessToken"
                      value={formData.accessToken}
                      onChange={handleInputChange}
                      className="form-control-clean"
                      placeholder="Collez votre lien d'accès ici"
                      required
                      disabled={loading}
                    />
                    <Form.Text className="text-muted mt-2">
                      Collez le lien complet que vous avez reçu ou seulement le token d'accès
                    </Form.Text>
                  </Form.Group>

                  <button
                    type="submit"
                    className="btn-clean-primary w-100 mb-3"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          className="me-2"
                        />
                        Vérification...
                      </>
                    ) : (
                      'Accéder aux photos'
                    )}
                  </button>
                </Form>
              )}

              {/* Help Text */}
              <div className="text-center mt-4">
                <small className="text-muted">
                  {activeTab === 'login'
                    ? 'Vous n\'avez pas de compte ? Contactez votre photographe.'
                    : 'Vous n\'avez pas reçu de lien d\'accès ? Vérifiez vos emails ou contactez votre photographe.'
                  }
                </small>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-4">
            <small className="text-muted">
              © 2025 Les photos de Lenny - Plateforme sécurisée
            </small>
          </div>
        </div>
      </Container>
    </div>
  );
}