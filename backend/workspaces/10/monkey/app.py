from flask import Flask, render_template

# Initialize the Flask application
app = Flask(__name__)

@app.route('/')
def index():
    """
    Renders the home page for the Monkey project website.
    """
    return render_template('index.html', title="Welcome to Monkey!")

@app.route('/about')
def about():
    """
    Renders the About page.
    """
    return render_template('about.html', title="About Monkey")

# Example of how to run the app (useful for development)
if __name__ == '__main__':
    # In a real development environment, you might use a WSGI server.
    # For simple execution, we use app.run.
    app.run(debug=True)
