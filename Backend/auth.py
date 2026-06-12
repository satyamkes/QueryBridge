import jwt
import datetime
from functools import wraps
from flask import request, jsonify
import logging

from config import Config

logger = logging.getLogger(__name__)

def generate_tokens(user_id: int, username: str, role: str):
    access_token_payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
        'iat': datetime.datetime.utcnow()
    }
    refresh_token_payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7),
        'iat': datetime.datetime.utcnow()
    }
    
    access_token = jwt.encode(access_token_payload, Config.SECRET_KEY, algorithm='HS256')
    refresh_token = jwt.encode(refresh_token_payload, Config.SECRET_KEY, algorithm='HS256')
    
    return access_token, refresh_token

def verify_token(token: str):
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'status': 'error', 'message': 'Missing or invalid token'}), 401
            
        token = auth_header.split(' ')[1]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'status': 'error', 'message': 'Token expired or invalid'}), 401
            
        request.user = payload
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'status': 'error', 'message': 'Missing or invalid token'}), 401
            
        token = auth_header.split(' ')[1]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'status': 'error', 'message': 'Token expired or invalid'}), 401
            
        if payload.get('role') != 'admin':
            return jsonify({'status': 'error', 'message': 'Admin access required'}), 403
            
        request.user = payload
        return f(*args, **kwargs)
    return decorated
